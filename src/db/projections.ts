import { users } from "./schema.ts";

// Второй слой защиты от утечки, а не единственный: обработчики отдают строку
// целиком, но fastify сериализует ответ строго по схеме операции, поэтому
// полей, которых нет в контракте, в теле не будет (проверено — creatorId,
// createdAt и updatedAt отбрасываются). Проекции нужны затем, чтобы секрет не
// покидал базу вовсе: если у маршрута когда-нибудь не окажется схемы ответа,
// сериализатор перестанет прикрывать.
//
// columns — для relational query API, fields — для .returning() у
// insert/update. Проекций две, по одной на версию контракта: phone добавлен в
// User только с v2 (@added в main.tsp).
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
