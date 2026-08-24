import etag from "@fastify/etag";
import fp from "fastify-plugin";

export default fp(
  async (fastify) => {
    // Считает ETag по телу ответа и сам отдаёт 304 на If-None-Match. Уже
    // выставленный обработчиком заголовок не перезаписывает — этим пользуются
    // курсы, где ETag строится из updatedAt, чтобы его можно было сверить с
    // If-Match, не пересобирая тело байт в байт.
    await fastify.register(etag, { replyWith304: true });
  },
  { name: "etag" },
);
