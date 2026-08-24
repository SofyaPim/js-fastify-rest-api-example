import type { RouteHandlers } from "../types/handlers/fastify.gen.ts";
import lessons from "./api/courses/lessons.ts";
import courses from "./api/courses.ts";
import tokens from "./api/tokens.ts";
import users from "./api/users.ts";

// Тип полный, а не Partial: сгенерированный RouteHandlers перечисляет все
// операции контракта, поэтому забытый обработчик — ошибка компиляции. С Partial
// это было видно только в рантайме, предупреждением fastify-openapi-glue.
const serviceHandlers: RouteHandlers = {
  ...users,
  ...courses,
  ...lessons,
  ...tokens,
};

export default serviceHandlers;
