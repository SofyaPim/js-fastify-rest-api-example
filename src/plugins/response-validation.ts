import responseValidation from "@fastify/response-validation";
import ajvFormats from "ajv-formats";
import fp from "fastify-plugin";

// ajv-formats — CJS-пакет: в рантайме module.exports это сама функция, но под
// NodeNext TS видит пространство имён, поэтому берётся .default (в рантайме он
// указывает на ту же функцию).
const addFormats = ajvFormats.default;

export default fp(async (fastify) => {
  // Плагин поднимает свой ajv, и без ajv-formats он не знает форматов из
  // OpenAPI: int32 в схеме ответа (PageMeta) валил валидацию с «unknown format
  // "int32" ignored». В запросах это не проявлялось — там ajv у fastify свой.
  await fastify.register(responseValidation, {
    ajv: { plugins: [addFormats] },
  });
});
