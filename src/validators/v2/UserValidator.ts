import * as z from "zod";
import { users } from "../../db/schema.ts";
import unique from "../../rules/unique.ts";
import { zUserCreateDto, zUserEditDto } from "../../types/handlers/v2/zod.gen.ts";
import type { DrizzleDB } from "../../types/index.ts";

// Тот же валидатор, но поверх схем v2: в них есть phone, и своя копия правил
// нужна ровно потому, что расширяется сгенерированная схема, а не написанная
// руками.
class UserValidatorV2 {
  static validateCreate(db: DrizzleDB, data: unknown) {
    const schema = zUserCreateDto.extend({
      email: z
        .string()
        .toLowerCase()
        .refine(unique(db, { table: users, field: "email" }), {
          message: "email is already taken",
        }),
    });

    return schema.parseAsync(data);
  }

  static validateEdit(_db: DrizzleDB, data: unknown) {
    return zUserEditDto.parseAsync(data);
  }
}

export default UserValidatorV2;
