/** biome-ignore-all lint/complexity/noStaticOnlyClass: - */

import vine from '@vinejs/vine';
import { users } from '../db/schema.ts';
import uniqueRule from '../rules/unique.ts';
import type { DrizzleDB, User } from '../types/index.ts';

const schema = vine.object({
  email: vine
    .string()
    .email()
    .normalizeEmail({ all_lowercase: true })
    .use(uniqueRule({ schema: users })),
});
const validator = vine.compile(schema);

class UserValidator {
  static validate(db: DrizzleDB, data: User) {
    return validator.validate(data, { meta: { db } });
  }
}

export default UserValidator;
