import { createAssistantServer, type ServerConfig } from '@sentroy-co/form-assist/server';
/** Construct once per isolate with host-provided authentication, policy, and provider bindings. */
export function createWorkerHandler(config: ServerConfig): { fetch(request: Request): Promise<Response> } {
  const server = createAssistantServer(config);
  return { fetch(request) { return server.handle(request); } };
}
