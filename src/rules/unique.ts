import { eq } from "drizzle-orm";
import type { DrizzleDB, DrizzleTable } from "../types/index.ts";

// Поле называется table, а не schema: в проекте schema уже значит и настройки
// маршрута fastify, и схемы zod, и объект таблиц drizzle.
type Options = {
  table: DrizzleTable;
  field: string;
};

// Проверка уникальности это единственное правило, которое нельзя выразить в
// OpenAPI: она зависит от состояния базы. Возвращается предикат для .refine(),
// поэтому правило подключается к любой строковой схеме zod.
export default function unique(db: DrizzleDB, options: Options) {
  return async (value: string) => {
    const [row] = await db
      .select()
      .from(options.table)
      // @ts-expect-error index signature for dynamic column access
      .where(eq(options.table[options.field], value));
    return !row;
  };
}
