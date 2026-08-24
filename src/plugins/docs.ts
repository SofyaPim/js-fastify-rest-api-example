import scalar from "@scalar/fastify-api-reference";
import fp from "fastify-plugin";
import openapiV1 from "../../tsp-output/@typespec/openapi3/openapi.v1.json" with { type: "json" };
import openapiV2 from "../../tsp-output/@typespec/openapi3/openapi.v2.json" with { type: "json" };

// Документация отдаётся из тех же спек, по которым зарегистрированы маршруты,
// поэтому разойтись с реализацией ей неоткуда.
export default fp(
  async (fastify) => {
    fastify.get("/openapi.json", async () => openapiV1);

    // servers переписывается на префикс: пути внутри документа префикса не
    // знают (glue навешивает его при регистрации), и без этой правки клиент,
    // собранный по документу v2, стучался бы в корень — то есть в v1.
    const v2 = { ...openapiV2, servers: [{ url: "/v2", description: "Версия 2" }] };
    fastify.get("/v2/openapi.json", async () => v2);

    await fastify.register(scalar, {
      routePrefix: "/docs",
      configuration: {
        sources: [
          { url: "/openapi.json", title: "v1" },
          { url: "/v2/openapi.json", title: "v2" },
        ],
      },
    });
  },
  { name: "docs" },
);
