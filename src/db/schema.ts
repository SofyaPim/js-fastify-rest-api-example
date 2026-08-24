import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// Точность миллисекундная: из updatedAt строится ETag, а при секундной две
// правки в пределах одной секунды дают одинаковый валидатор.
//
// Таймстемпы ведёт drizzle, а не SQL-дефолты: updatedAt иначе не обновляется
// никогда — обработчики его не писали, а DEFAULT срабатывает только на INSERT.
// Тип integer, а не text: раньше default (unixepoch()) клал число в текстовую
// колонку, и наружу уезжала строка вида "1787349516".
const timestamps = {
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
};

export const users = sqliteTable("users", {
  id: integer("id").primaryKey(),
  fullName: text("full_name"),
  email: text("email").notNull().unique(),
  passwordDigest: text("password_digest").notNull(),
  // Появляется в контракте только с v2 (@added в main.tsp). Nullable: колонка
  // добавляется существующей таблице, и NOT NULL упёрся бы в уже лежащие
  // строки — как было с password_digest.
  phone: text("phone"),
  ...timestamps,
});

export const courses = sqliteTable("courses", {
  id: integer("id").primaryKey(),
  name: text("name").notNull(),
  // Запрет, а не каскад: курс не перестаёт существовать от того, что автор
  // ушёл. Что делать с осиротевшими курсами — решение приложения, и оно
  // отвечает 409, а не молча сносит данные из миграции.
  creatorId: integer("creator_id")
    .references(() => users.id, { onDelete: "restrict" })
    .notNull(),
  description: text("description").notNull(),
  ...timestamps,
});

export const courseLessons = sqliteTable("course_lessons", {
  id: integer("id").primaryKey(),
  name: text("name").notNull(),
  // Тоже запрет, хотя урок вне курса не существует: удаление уроков делает
  // обработчик в транзакции. Поведение видно в коде, а не только в миграции.
  courseId: integer("courseId")
    .references(() => courses.id, { onDelete: "restrict" })
    .notNull(),
  body: text("body").notNull(),
  ...timestamps,
});
