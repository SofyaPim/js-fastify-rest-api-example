import type { RouteHandlers } from '../types/handlers/fastify.gen.ts';
import users from './api/users.ts';
import courses from './api/courses.ts';
import tokens from './api/tokens.ts';
import root from './root.ts';

const serviceHandlers: Partial<RouteHandlers> = {
  ...root,
  ...users,
  ...courses,
  ...tokens,
};

export default serviceHandlers;
