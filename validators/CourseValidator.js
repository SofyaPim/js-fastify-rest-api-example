import vine from '@vinejs/vine'

const schema = vine.object({
  // name: vine.string(),
  // description: vine.string(),
}).allowUnknownProperties()
const validator = vine.compile(schema)

class CourseValidator {
  /**
   * @param {import('../types/index.ts').DrizzleDB} db
   * @param {Partial<import('../types/index.ts').Course>} data
   */
  static validate(db, data) {
    return validator.validate(data, { meta: { db } })
  }
}

export default CourseValidator
