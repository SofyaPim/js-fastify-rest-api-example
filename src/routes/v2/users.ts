import { asc, count, eq } from "drizzle-orm";
import { publicUserColumnsV2, publicUserFieldsV2 } from "../../db/projections.ts";
import * as schemas from "../../db/schema.ts";
import { hashPassword } from "../../lib/password.ts";
import { defineHandlersV2 } from "../../lib/utils-v2.ts";
import { buildPageMeta, ensure, getPagingOptions } from "../../lib/utils.ts";
import UserValidatorV2 from "../../validators/v2/UserValidator.ts";

// Обработчики пользователей продублированы, а не переиспользованы из v1,
// намеренно: именно здесь версии и расходятся. В v2 у User есть phone — он
// принимается на запись и попадает в ответ, а проекция v1 его не отдаёт.
// Единственная альтернатива — обобщать по проекции и типу версии, и это
// запутывает ровно то место, ради демонстрации которого версии и существуют.
const handlers = defineHandlersV2({
  async usersIndex(request, reply) {
    const page = request.query?.page ?? 1;
    const perPage = request.query?.perPage ?? 10;

    const users = await request.db.query.users.findMany({
      columns: publicUserColumnsV2,
      orderBy: asc(schemas.users.id),
      ...getPagingOptions(page, perPage),
    });
    const [{ total }] = await request.db.select({ total: count() }).from(schemas.users);

    return reply.code(200).send({ data: users, meta: buildPageMeta(page, perPage, total) });
  },

  async usersShow(request, reply) {
    const user = await request.db.query.users.findFirst({
      columns: publicUserColumnsV2,
      where: eq(schemas.users.id, request.params.id),
    });
    ensure(user, 404);
    return reply.code(200).send(user);
  },

  async usersCreate(request, reply) {
    const { password, ...validated } = await UserValidatorV2.validateCreate(
      request.db,
      request.body,
    );
    const [user] = await request.db
      .insert(schemas.users)
      .values({ ...validated, passwordDigest: await hashPassword(password) })
      .returning(publicUserFieldsV2);

    return reply.code(201).send(user);
  },

  async usersUpdate(request, reply) {
    const existing = await request.db.query.users.findFirst({
      columns: publicUserColumnsV2,
      where: eq(schemas.users.id, request.params.id),
    });
    ensure(existing, 404);

    const { password, ...validated } = await UserValidatorV2.validateEdit(request.db, request.body);
    const values = password
      ? { ...validated, passwordDigest: await hashPassword(password) }
      : validated;

    if (Object.keys(values).length === 0) {
      return reply.code(200).send(existing);
    }

    const [user] = await request.db
      .update(schemas.users)
      .set(values)
      .where(eq(schemas.users.id, request.params.id))
      .returning(publicUserFieldsV2);
    return reply.code(200).send(user);
  },

  async usersDestroy(request, reply) {
    const [user] = await request.db
      .delete(schemas.users)
      .where(eq(schemas.users.id, request.params.id))
      .returning(publicUserFieldsV2);
    ensure(user, 404);
    return reply.code(204).send();
  },
});

export default handlers;
