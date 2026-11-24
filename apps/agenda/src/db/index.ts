import path from "node:path";
import { createDbGetter } from "@stackline/core/db";
import * as schema from "./schema";
import { seedIfEmpty } from "./seed";

export const getDb = createDbGetter({
  key: "agenda",
  schema,
  migrationsFolder: path.join(process.cwd(), "drizzle"),
  pgliteDir: path.join(process.cwd(), ".data", "pglite"),
  seed: seedIfEmpty,
});

export type Db = Awaited<ReturnType<typeof getDb>>;
export { schema };
