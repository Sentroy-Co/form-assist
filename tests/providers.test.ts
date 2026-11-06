import { describe, it, expect, vi } from 'vitest';
import { createOpenAIProvider, createAnthropicProvider, createGeminiProvider, createOpenAICompatibleProvider, createVercelGatewayProvider, createCloudflareGatewayProvider } from '../packages/form-assist/src/providers/index.js';
const plan = {protocolVersion:'1',requestId:'r',formId:'f',baseRevision:'v',changes:[],questions:[],warnings:[]};
const input = {form:{formId:'f',schemaVersion:'1',revision:'v',schema:{secret:'never send'},values:{},fields:[]},request:{protocolVersion:'1' as const,requestId:'r',formId:'f',baseRevision:'v',values:{},prompt:'hello',connectionId:'c',model:'explicit-model'}};
const response = (data: unknown, status = 200, headers?: HeadersInit) => new Response(JSON.stringify(data),{status,headers});
describe('provider transports', () => {
  it('uses explicit model and returns a bounded plan without schema', async () => { const fetch = vi.fn(async (_url: any, init: any) => { const body=JSON.parse(init.body); expect(body.model).toBe('explicit-model'); expect(init.body).not.toContain('never send'); return response({choices:[{message:{content:JSON.stringify(plan)}}]}); }); const result=await createOpenAIProvider({id:'c',apiKey:'secret',fetch}).propose(input); expect(result.plan).toEqual(plan); });
  it('handles Anthropic and Gemini envelopes', async () => { const anthropic=vi.fn(async () => response({content:[{type:'text',text:JSON.stringify(plan)}]})); const gemini=vi.fn(async () => response({candidates:[{content:{parts:[{text:JSON.stringify(plan)}]}}]})); expect((await createAnthropicProvider({id:'a',apiKey:'x',fetch:anthropic}).propose(input)).plan).toEqual(plan); expect((await createGeminiProvider({id:'g',apiKey:'x',fetch:gemini}).propose(input)).plan).toEqual(plan); });
  it('rejects malformed output and retries 429 within a fixed budget', async () => { const fetch=vi.fn().mockResolvedValueOnce(response({},429,{'retry-after':'0'})).mockResolvedValueOnce(response({choices:[{message:{content:'{'}}]})); await expect(createOpenAIProvider({id:'x',apiKey:'x',fetch,maxRetries:1}).propose(input)).rejects.toMatchObject({code:'INVALID_PROVIDER_RESPONSE'}); expect(fetch).toHaveBeenCalledTimes(2); });
  it('rejects unsafe hosts and impossible strict gateway BYOK', () => { expect(() => createOpenAICompatibleProvider({id:'x',apiKey:'x',endpoint:'http://localhost/v1',allowedHosts:['localhost']})).toThrow(); expect(() => createVercelGatewayProvider({id:'x',apiKey:'x',strictByok:true})).toThrow(); });
  it('keeps gateway authentication distinct from an absent upstream key', async () => { const fetch=vi.fn(async (_u: any,init: any) => {expect(init.headers['cf-aig-authorization']).toBe('Bearer gateway'); expect(init.headers.authorization).toBeUndefined(); return response({choices:[{message:{content:JSON.stringify(plan)}}]});}); await createCloudflareGatewayProvider({id:'c',apiKey:'gateway',accountId:'a',gatewayId:'g',upstream:'openai',fetch}).propose(input); });
});

describe('provider error and cancellation contracts', () => {
  it.each([[401,'PROVIDER_AUTH'],[403,'PROVIDER_AUTH'],[503,'PROVIDER_HTTP']] as const)('normalizes HTTP %s', async (status, code) => {
    const fetch=vi.fn(async () => response({},status));
    await expect(createOpenAIProvider({id:'x',apiKey:'x',fetch,maxRetries:0}).propose(input)).rejects.toMatchObject({code});
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('returns Retry-After without retrying early when it exceeds the deadline', async () => {
    const fetch=vi.fn(async () => response({},429,{'retry-after':'60'}));
    await expect(createOpenAIProvider({id:'x',apiKey:'x',fetch,timeoutMs:100,maxRetries:2}).propose(input)).rejects.toMatchObject({code:'RATE_LIMITED',retryAfterMs:60000});
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('aborts requests and normalizes timeout', async () => {
    const fetch = vi.fn((_url: any, init: any) => new Promise<Response>((_resolve,reject) => { init.signal.addEventListener('abort', () => reject(new Error('abort')), {once:true}); }));
    await expect(createOpenAIProvider({id:'x',apiKey:'x',fetch,timeoutMs:5}).propose(input)).rejects.toMatchObject({code:'TIMEOUT'});
    const controller = new AbortController(); const pending = createOpenAIProvider({id:'x',apiKey:'x',fetch}).propose({...input,signal:controller.signal}); controller.abort();
    await expect(pending).rejects.toMatchObject({code:'ABORTED'});
  });
  it('times out while reading a response body', async () => {
    const fetch = vi.fn(async (_url: any, init: any) => new Response(new ReadableStream({ start(stream) { init.signal.addEventListener('abort', () => stream.error(new Error('abort')), {once:true}); } })));
    await expect(createOpenAIProvider({id:'x',apiKey:'x',fetch,timeoutMs:5}).propose(input)).rejects.toMatchObject({code:'TIMEOUT'});
  });
  it('disables redirects and rejects unsupported gateway upstreams', async () => {
    const fetch=vi.fn(async (_url: any, init: any) => { expect(init.redirect).toBe('error'); return response({},302); });
    await expect(createOpenAIProvider({id:'x',apiKey:'x',fetch,maxRetries:0}).propose(input)).rejects.toMatchObject({code:'PROVIDER_HTTP'});
    expect(() => createCloudflareGatewayProvider({id:'x',apiKey:'x',accountId:'a',gatewayId:'g',upstream:'anthropic'})).toThrow();
  });
  it('rejects dangerous and oversized Workers model paths', async () => {
    const {createWorkersAIProvider} = await import('../packages/form-assist/src/providers/index.js');
    const provider=createWorkersAIProvider({id:'x',apiKey:'x',accountId:'a',fetch:vi.fn()});
    for (const model of ['a/../secret','a'.repeat(501)]) await expect(provider.propose({...input,request:{...input.request,model}})).rejects.toMatchObject({code:'INVALID_CONFIG'});
  });
});
