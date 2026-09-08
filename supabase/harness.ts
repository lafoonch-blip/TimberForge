/**
 * A real Postgres, in-process, for testing the migrations.
 *
 * WHY THIS EXISTS
 *
 * Until this file, `supabase/migrations/*.sql` had never been parsed by a
 * database. SQL is not typechecked by anything in this repo, so a missing comma
 * or a constraint that references a column added two files later would sail
 * through review and fail during `supabase db push` — against the live LandForge
 * project, which is the one place a failure is expensive.
 *
 * PGlite is Postgres 18 compiled to WebAssembly. It is the real planner, the
 * real constraint machinery and real pl/pgsql, so a migration that applies here
 * will apply on Supabase. What it does not have is Supabase's own furniture:
 * the `auth` schema, `auth.uid()`, and the `anon` / `authenticated` /
 * `service_role` roles. Those are stubbed below.
 *
 * WHAT THIS HARNESS CANNOT TELL YOU
 *
 * The stubs are approximations, and it is worth being precise about the gap:
 *
 *   * `auth.uid()` here reads a session GUC. On Supabase it reads a JWT claim.
 *     Policy LOGIC is therefore tested faithfully; JWT handling is not.
 *   * PGlite is single-connection, so nothing here exercises concurrency,
 *     locking, or the behaviour of two cruisers syncing at once.
 *   * Supabase's `auth.users` has many more columns. Only `id` is modelled,
 *     which is all the foreign keys reference.
 *
 * So: this harness proves the migrations are valid and the constraints and
 * policies behave as intended. It does not prove the deployment works.
 */

import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

export const MIGRATIONS_DIR = fileURLToPath(new URL('./migrations', import.meta.url));

/** Migration files in apply order. */
export function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
}

/**
 * The parts of a Supabase database that the migrations assume already exist.
 * Kept deliberately minimal — every line here is a claim about the real
 * environment, and a wrong claim makes the tests lie.
 */
const SUPABASE_PRELUDE = `
  create schema if not exists auth;
  create schema if not exists extensions;

  -- Supabase's real auth.users is far wider. Only id is referenced by any
  -- TimberForge foreign key, so only id is modelled.
  create table if not exists auth.users (
    id    uuid primary key,
    email text
  );

  -- On Supabase this reads a claim out of the request JWT. Here it reads a
  -- session GUC, which lets a test say "now act as this user".
  create or replace function auth.uid()
  returns uuid
  language sql
  stable
  as $fn$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
  $fn$;
`;

/** Roles must exist before any GRANT or `create policy ... to <role>`. */
const ROLES = ['anon', 'authenticated', 'service_role'];

export interface Harness {
  db: PGlite;
  /** Run subsequent statements as this user id (null = unauthenticated). */
  actAs(userId: string | null): Promise<void>;
  /** Run as a role, e.g. 'authenticated'. RLS applies to non-superusers only. */
  actAsRole(role: string): Promise<void>;
  /** Return to the owning superuser, bypassing RLS. */
  actAsOwner(): Promise<void>;
  /** Insert a user into the stub auth.users and return the id. */
  makeUser(id?: string): Promise<string>;
  close(): Promise<void>;
}

export interface HarnessOptions {
  /**
   * When true, create a `public.land_parcels` table before the migrations run,
   * so that 0004's discovery block finds a target and creates the foreign key.
   * When false (the default) the block should skip the FK and say so — which is
   * itself a behaviour worth testing.
   */
  withLandForgeParcels?: boolean;
  /** Override the parcel primary key type, to test the non-uuid refusal. */
  parcelPkType?: 'uuid' | 'bigint';
}

export async function createHarness(opts: HarnessOptions = {}): Promise<Harness> {
  const db = await PGlite.create();

  await db.exec(SUPABASE_PRELUDE);

  for (const role of ROLES) {
    // `create role if not exists` does not exist; the DO block is the idiom.
    await db.exec(`
      do $$
      begin
        if not exists (select 1 from pg_roles where rolname = '${role}') then
          create role ${role} nologin noinherit;
        end if;
      end;
      $$;
      grant usage on schema public to ${role};
      grant usage on schema auth to ${role};
    `);
  }

  if (opts.withLandForgeParcels) {
    const pk = opts.parcelPkType ?? 'uuid';
    const def =
      pk === 'uuid'
        ? 'id uuid primary key default gen_random_uuid()'
        : 'id bigint generated always as identity primary key';
    // A minimal stand-in for LandForge's parcel table. Only the primary key
    // matters to the bridge; the rest is here so the shape reads plausibly.
    await db.exec(`
      create table public.land_parcels (
        ${def},
        acres numeric(12,3),
        owner_id uuid
      );
    `);
  }

  const notices: string[] = [];
  for (const file of migrationFiles()) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
    try {
      await db.exec(sql);
    } catch (err) {
      throw new Error(
        `Migration ${file} failed to apply:\n${(err as Error).message}`,
        { cause: err }
      );
    }
    notices.push(file);
  }

  // Session-scoped, not transaction-scoped. set_config(..., true) is local to
  // the current transaction, and outside an explicit transaction that means it
  // lasts exactly one statement — so every subsequent query would see a null
  // uid and the RLS tests would pass for entirely the wrong reason.
  const actAs = async (userId: string | null): Promise<void> => {
    await db.exec(
      userId === null
        ? `select set_config('request.jwt.claim.sub', '', false);`
        : `select set_config('request.jwt.claim.sub', '${userId}', false);`
    );
  };

  return {
    db,
    actAs,
    actAsRole: async (role: string) => {
      await db.exec(`set role ${role};`);
    },
    actAsOwner: async () => {
      await db.exec('reset role;');
    },
    makeUser: async (id?: string) => {
      const r = await db.query<{ id: string }>(
        `insert into auth.users (id) values (coalesce($1::uuid, gen_random_uuid()))
         returning id`,
        [id ?? null]
      );
      return r.rows[0]!.id;
    },
    close: async () => {
      await db.close();
    },
  };
}

/**
 * Runs a statement and returns the error message, or null if it succeeded.
 * Used by the constraint tests, which are all of the form "this must be
 * rejected, and for the stated reason".
 */
export async function expectFailure(
  db: PGlite,
  sql: string,
  params: unknown[] = []
): Promise<string | null> {
  try {
    await db.query(sql, params);
    return null;
  } catch (err) {
    return (err as Error).message;
  }
}
