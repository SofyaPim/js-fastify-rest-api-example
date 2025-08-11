import vine from '@vinejs/vine';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schemas from '../db/schema.ts';

/**
 * @param {any} value
 * @param {{ schema: import('../types/index.ts').DrizzleSchema }} options
 * @param {import('@vinejs/vine/types').FieldContext} field
 */
async function unique(value, options, field) {
  /**
   * We do not want to deal with non-string
   * values. The "string" rule will handle the
   * the validation.
   */
  if (typeof value !== 'string') {
    return;
  }

  /** @type {ReturnType<typeof drizzle<typeof schemas>>} */
  const db = field.meta.db;
  const [row] = await db
    .select()
    .from(options.schema)
    .where(eq(options.schema[field.name], value));

  if (row) {
    field.report(
      `The {{ field }} field (= ${value}) is not unique.`,
      'unique',
      field,
    );
  }
}

export default vine.createRule(unique, {
  // implicit: true,
  isAsync: true,
});
