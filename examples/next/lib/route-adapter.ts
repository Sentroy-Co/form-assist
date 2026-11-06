import { createAssistantServer, type ServerConfig } from '@sentroy-co/form-assist/server';
/** Supply host session authentication and authorization before exporting POST from a route. */
export function makeAuthenticatedPost(config: ServerConfig): (request: Request) => Promise<Response> {
  const server = createAssistantServer(config);
  return request => server.handle(request);
}
