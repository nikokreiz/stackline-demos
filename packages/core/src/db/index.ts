import type { PgDatabase } from "drizzle-orm/pg-core";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AppDb<S extends Record<string, unknown>> = PgDatabase<any, S>;

type DbOptions<S extends Record<string, unknown>> = {
  /** Clave única por app, para no mezclar instancias en desarrollo. */
  key: string;
  schema: S;
  /** Carpeta con las migraciones SQL generadas por drizzle-kit. */
  migrationsFolder: string;
  /** Carpeta de la base embebida (PGlite) cuando no hay DATABASE_URL. */
  pgliteDir: string;
  /** Se ejecuta tras migrar; debe ser idempotente (no duplicar datos). */
  seed?: (db: AppDb<S>) => Promise<void>;
};

/**
 * Devuelve una función que entrega la base de datos lista para usar.
 *
 * - Con `DATABASE_URL` usa Postgres real (Supabase, Neon, etc.).
 * - Sin `DATABASE_URL` usa PGlite: un Postgres embebido en archivo local,
 *   para que la demo funcione con `pnpm dev` sin instalar nada.
 *
 * La primera llamada aplica las migraciones y el seed de demostración.
 */
export function createDbGetter<S extends Record<string, unknown>>(opts: DbOptions<S>) {
  const g = globalThis as unknown as Record<string, Promise<AppDb<S>> | undefined>;
  const k = `__stackline_db_${opts.key}`;
  return function getDb(): Promise<AppDb<S>> {
    if (!g[k]) {
      g[k] = init(opts).catch((err) => {
        g[k] = undefined;
        throw err;
      });
    }
    return g[k]!;
  };
}

async function init<S extends Record<string, unknown>>(opts: DbOptions<S>): Promise<AppDb<S>> {
  let db: AppDb<S>;
  const url = process.env.DATABASE_URL;
  if (url) {
    const { default: postgres } = await import("postgres");
    const { drizzle } = await import("drizzle-orm/postgres-js");
    const { migrate } = await import("drizzle-orm/postgres-js/migrator");
    const client = postgres(url, { prepare: false, max: 5 });
    const pg = drizzle(client, { schema: opts.schema });
    await migrate(pg, { migrationsFolder: opts.migrationsFolder });
    db = pg as unknown as AppDb<S>;
  } else {
    const { mkdir } = await import("node:fs/promises");
    await mkdir(opts.pgliteDir, { recursive: true });
    const { PGlite } = await import("@electric-sql/pglite");
    const { drizzle } = await import("drizzle-orm/pglite");
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    const client = new PGlite(opts.pgliteDir);
    const lite = drizzle({ client, schema: opts.schema });
    await migrate(lite, { migrationsFolder: opts.migrationsFolder });
    db = lite as unknown as AppDb<S>;
  }
  if (opts.seed) await opts.seed(db);
  return db;
}
