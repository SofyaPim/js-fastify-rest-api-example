import { httpErrors } from "@fastify/sensible";
import type { RouteHandlers } from "../types/handlers/v1/fastify.gen.ts";

export function getPagingOptions(page: number, perPage = 10) {
  return {
    limit: perPage,
    offset: (page - 1) * perPage,
  };
}

// Ответ списка обязан сообщать, где клиент находится: page без total не даёт
// понять, есть ли следующая страница.
export function buildPageMeta(page: number, perPage: number, total: number) {
  return {
    page,
    perPage,
    total,
    totalPages: Math.ceil(total / perPage),
  };
}

// Раньше здесь вызывался createError, который ошибку только создаёт. Из-за
// этого 404 не наступал никогда: отсутствующая запись давала 200 с пустым
// телом, а /tokens с неизвестным email — 500 при обращении к полю у undefined.
// Хуже того, сигнатура asserts заставляла tsc ручаться за проверку, которой не
// происходило.
export function ensure<T>(
  value: T | null | undefined,
  status: number = 404,
  msg = "Not Found",
): asserts value is NonNullable<T> {
  if (value == null) throw httpErrors.createError(status, msg);
}

export function defineHandlers<T extends Partial<RouteHandlers>>(t: T) {
  return t;
}
