import type { RouteHandlers as RouteHandlersV2 } from "../types/handlers/v2/fastify.gen.ts";

// Отдельный хелпер под v2: сгенерированный RouteHandlers у версий разный, и
// один defineHandlers обе не обслужит.
export function defineHandlersV2<T extends Partial<RouteHandlersV2>>(t: T) {
  return t;
}
