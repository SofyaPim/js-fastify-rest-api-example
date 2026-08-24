import type { RouteHandlers } from "../../types/handlers/v2/fastify.gen.ts";
import lessons from "../api/courses/lessons.ts";
import courses from "../api/courses.ts";
import tokens from "../api/tokens.ts";
import users from "./users.ts";

// Курсы, уроки и токены между версиями не менялись, поэтому берутся те же
// обработчики: типы у них структурно совпадают. Расходятся только пользователи.
const serviceHandlers: RouteHandlers = {
  ...users,
  ...courses,
  ...lessons,
  ...tokens,
};

export default serviceHandlers;
