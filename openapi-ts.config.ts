import { defineConfig } from "@hey-api/openapi-ts";

// Обе версии контракта генерируются отдельно: у v2 в User есть phone, которого
// нет в v1, поэтому типы обработчиков, схемы zod и клиент у них разные.
const forVersion = (version: "v1" | "v2") => ({
  input: `./tsp-output/@typespec/openapi3/openapi.${version}.json`,
  output: `src/types/handlers/${version}`,
  plugins: ["fastify", "zod", "@hey-api/client-fetch", "@hey-api/sdk"] as const,
});

export default defineConfig([forVersion("v1"), forVersion("v2")]);
