import { users } from "./schema.ts";

// Хеш пароля не должен покидать базу, а обработчики отдают строку целиком и
// схема ответа лишнее не отсечёт: additionalProperties: false у моделей нет.
// Поэтому публичная проекция описана здесь — columns для relational query API,
// fields для .returning() у insert/update.
//
// Проекций две, по одной на версию контракта. phone добавлен в User только с v2
// (@added в main.tsp), и в v1 он не должен появляться: это тот же класс утечки,
// что был у password_digest, просто менее опасный.
//
// Лежит отдельно от schema.ts намеренно: в объект, который уходит в
// drizzle({ schema }), должны попадать только таблицы.
export const publicUserColumns = {
  id: true,
  fullName: true,
  email: true,
} as const;

export const publicUserFields = {
  id: users.id,
  fullName: users.fullName,
  email: users.email,
};

export const publicUserColumnsV2 = {
  ...publicUserColumns,
  phone: true,
} as const;

export const publicUserFieldsV2 = {
  ...publicUserFields,
  phone: users.phone,
};
