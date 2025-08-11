/** biome-ignore-all lint/complexity/noStaticOnlyClass: - */

import type { CourseInsert, DrizzleDB } from '../types/index.ts'
import { object, parseAsync, string } from 'valibot'

// Keep validation permissive: accept fields used by routes
// and let handlers add/override creatorId.
const schema = object({
  name: string(),
  description: string(),
})

class CourseValidator {
  static validate(_db: DrizzleDB, data: CourseInsert) {
    return parseAsync(schema, data)
  }
}

export default CourseValidator
