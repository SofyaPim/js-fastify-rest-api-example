import Database from "better-sqlite3";

import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import fp from "fastify-plugin";
import * as schemas from "../db/schema.ts";

export default fp(
  async (fastify) => {
    const sqlite = new Database(":memory:");
    const db = drizzle(sqlite, { schema: schemas });
    migrate(db, { migrationsFolder: "drizzle" });

    // Сиды — инструмент разработки, и импорт у них динамический не для красоты:
    // db/seeds.ts тянет @faker-js/faker из devDependencies, поэтому со
    // статическим импортом боевая установка не поднималась вовсе
    // («Cannot find package '@faker-js/faker'»). А если бы поднялась — завела бы
    // в базе трёх выдуманных пользователей.
    if (fastify.config.NODE_ENV !== "production") {
      const { default: seed } = await import("../db/seeds.ts");
      await seed(db);
    }

    if (!fastify.hasRequestDecorator("db")) {
      fastify.decorate("db", db);
      fastify.decorateRequest("db", {
        getter() {
          return db; // общий singleton
        },
      });
    }
  },
  // Зависимость от env объявлена явно: по алфавиту autoload грузит drizzle
  // раньше env, и fastify.config к этому моменту не существовало бы.
  { name: "drizzle", dependencies: ["env"] },
);
