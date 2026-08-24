import scalar from "@scalar/fastify-api-reference";
import fp from "fastify-plugin";
import openapiV1 from "../../tsp-output/@typespec/openapi3/openapi.v1.json" with { type: "json" };
import openapiV2 from "../../tsp-output/@typespec/openapi3/openapi.v2.json" with { type: "json" };

// Документация отдаётся из тех же спек, по которым зарегистрированы маршруты,
// поэтому разойтись с реализацией ей неоткуда.
export default fp(
  async (fastify) => {
    // servers переписывается на префикс версии: пути внутри документа префикса
    // не знают, его навешивает glue при регистрации. Без этой подстановки
    // клиент, собранный по документу, стучался бы в корень, где ничего нет.
    const withPrefix = (document: object, prefix: string, description: string) => ({
      ...document,
      servers: [{ url: prefix, description }],
    });

    const v1 = withPrefix(openapiV1, "/v1", "Версия 1");
    const v2 = withPrefix(openapiV2, "/v2", "Версия 2");

    fastify.get("/v1/openapi.json", async () => v1);
    fastify.get("/v2/openapi.json", async () => v2);

    await fastify.register(scalar, {
      routePrefix: "/docs",
      configuration: {
        sources: [
          { url: "/v1/openapi.json", title: "v1" },
          { url: "/v2/openapi.json", title: "v2" },
        ],
      },
    });
  },
  { name: "docs" },
);
