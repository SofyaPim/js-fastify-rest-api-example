import { httpErrors } from "@fastify/sensible";

// ETag строится из updatedAt, а не из тела ответа: тело пришлось бы
// пересобирать байт в байт, чтобы сверить с присланным If-Match. Слабый
// валидатор (W/) — потому что сравнение идёт по версии записи, а не по
// точному представлению.
export function entityTag(updatedAt: Date) {
  return `W/"${updatedAt.getTime()}"`;
}

// If-Match необязателен: без него правка проходит как раньше. Но если клиент
// его прислал, а запись с тех пор изменилась — правка отклоняется, иначе two
// одновременных PUT молча перезаписывают друг друга.
export function ensureMatches(ifMatch: string | undefined, updatedAt: Date) {
  if (ifMatch === undefined) return;

  const current = entityTag(updatedAt);
  const candidates = ifMatch.split(",").map((value) => value.trim());
  if (candidates.includes("*") || candidates.includes(current)) return;

  throw httpErrors.preconditionFailed("The resource has changed since it was fetched");
}
