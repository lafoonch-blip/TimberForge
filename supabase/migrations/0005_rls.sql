-- =============================================================================
-- 0005  Row level security
-- =============================================================================
--
-- ADDITIVE ONLY. Enables RLS on `timberforge` tables and defines the policies.
-- Touches nothing in `public`; LandForge's own policies are untouched.
--
-- -----------------------------------------------------------------------------
-- THE MODEL
-- -----------------------------------------------------------------------------
-- Everything hangs off the cruise. A cruise has one owner, and any number of
-- members with a role. Stands, plots, trees, compilations, QA findings,
-- predictions and feed rows are all reachable from exactly one cruise, so their
-- policies are "can you see the cruise this belongs to".
--
-- Roles:
--   owner   — full control, including delete and member management
--   editor  — collect and correct field data, compile
--   viewer  — read only
--
-- TimberForge deliberately does NOT reuse a LandForge organisation model here.
-- It may well be right to unify them later, but guessing at the shape of
-- somebody else's membership table and building authorization on the guess is
-- how you end up with a security bug rather than a refactor.
--
-- -----------------------------------------------------------------------------
-- WHY THE HELPERS ARE SECURITY DEFINER
-- -----------------------------------------------------------------------------
-- A policy on `stand` that selects from `cruise` triggers `cruise`'s own
-- policies, which select from `cruise_member`, whose policy selects from
-- `cruise`... Postgres detects the loop and raises "infinite recursion detected
-- in policy for relation", and it does so at query time, not at migration time.
--
-- Routing every check through a SECURITY DEFINER function breaks the cycle: the
-- function body runs as its owner with RLS bypassed, so it can read the
-- membership tables directly. They are marked STABLE so the planner calls them
-- once per query rather than once per row, which matters a great deal on a tree
-- table with a hundred thousand rows.
--
-- search_path is pinned on each one. A SECURITY DEFINER function with a mutable
-- search_path is a privilege escalation waiting to happen: anyone who can
-- create a table in a schema earlier on the path can substitute their own
-- `cruise_member`.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Membership
-- -----------------------------------------------------------------------------

create type timberforge.cruise_role as enum ('owner', 'editor', 'viewer');

create table timberforge.cruise_member (
  cruise_id  uuid not null references timberforge.cruise (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  role       timberforge.cruise_role not null default 'viewer',
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (cruise_id, user_id)
);

comment on table timberforge.cruise_member is
  'Explicit sharing. The cruise owner is authoritative via cruise.owner_id and '
  'does not need a row here, though one is harmless.';

create index cruise_member_user_idx on timberforge.cruise_member (user_id);

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------

create or replace function timberforge.can_read_cruise(p_cruise_id uuid)
returns boolean
language sql
stable
security definer
set search_path = timberforge, pg_temp
as $$
  select exists (
    select 1 from timberforge.cruise c
    where c.id = p_cruise_id
      and (
        c.owner_id = auth.uid()
        or exists (
          select 1 from timberforge.cruise_member m
          where m.cruise_id = c.id and m.user_id = auth.uid()
        )
      )
  );
$$;

create or replace function timberforge.can_write_cruise(p_cruise_id uuid)
returns boolean
language sql
stable
security definer
set search_path = timberforge, pg_temp
as $$
  select exists (
    select 1 from timberforge.cruise c
    where c.id = p_cruise_id
      and (
        c.owner_id = auth.uid()
        or exists (
          select 1 from timberforge.cruise_member m
          where m.cruise_id = c.id
            and m.user_id = auth.uid()
            and m.role in ('owner', 'editor')
        )
      )
  );
$$;

create or replace function timberforge.owns_cruise(p_cruise_id uuid)
returns boolean
language sql
stable
security definer
set search_path = timberforge, pg_temp
as $$
  select exists (
    select 1 from timberforge.cruise c
    where c.id = p_cruise_id and c.owner_id = auth.uid()
  );
$$;

-- Reachability helpers for the deeper tables. Each is one indexed hop.

create or replace function timberforge.cruise_of_stand(p_stand_id uuid)
returns uuid
language sql
stable
security definer
set search_path = timberforge, pg_temp
as $$
  select cruise_id from timberforge.stand where id = p_stand_id;
$$;

create or replace function timberforge.cruise_of_plot(p_plot_id uuid)
returns uuid
language sql
stable
security definer
set search_path = timberforge, pg_temp
as $$
  select s.cruise_id
  from timberforge.plot p
  join timberforge.stand s on s.id = p.stand_id
  where p.id = p_plot_id;
$$;

create or replace function timberforge.cruise_of_tree(p_tree_id uuid)
returns uuid
language sql
stable
security definer
set search_path = timberforge, pg_temp
as $$
  select s.cruise_id
  from timberforge.tree t
  join timberforge.plot p on p.id = t.plot_id
  join timberforge.stand s on s.id = p.stand_id
  where t.id = p_tree_id;
$$;

-- -----------------------------------------------------------------------------
-- Enable RLS everywhere
-- -----------------------------------------------------------------------------
-- Every table, without exception. A table with RLS left off is readable by any
-- authenticated user through the API, and the omission is invisible until
-- somebody goes looking.

alter table timberforge.region_profile enable row level security;
alter table timberforge.species        enable row level security;
alter table timberforge.cruise         enable row level security;
alter table timberforge.cruise_member  enable row level security;
alter table timberforge.stand          enable row level security;
alter table timberforge.plot           enable row level security;
alter table timberforge.tree           enable row level security;
alter table timberforge.height_sample  enable row level security;
alter table timberforge.compilation    enable row level security;
alter table timberforge.qa_finding     enable row level security;
alter table timberforge.prediction     enable row level security;
alter table timberforge.parcel_link    enable row level security;
alter table timberforge.timber_feed    enable row level security;

-- -----------------------------------------------------------------------------
-- Reference data
-- -----------------------------------------------------------------------------

-- Built-in region profiles are readable by anyone signed in; they are shipped
-- configuration, not user data.
create policy region_read on timberforge.region_profile
  for select to authenticated
  using (is_builtin or owner_id = auth.uid());

create policy region_insert on timberforge.region_profile
  for insert to authenticated
  with check (not is_builtin and owner_id = auth.uid());

create policy region_update on timberforge.region_profile
  for update to authenticated
  using (not is_builtin and owner_id = auth.uid())
  with check (not is_builtin and owner_id = auth.uid());

create policy region_delete on timberforge.region_profile
  for delete to authenticated
  using (not is_builtin and owner_id = auth.uid());
-- Note there is no policy permitting a built-in profile to be modified by
-- anyone. Seeding is done by the migration, which runs outside RLS.

create policy species_read on timberforge.species
  for select to authenticated
  using (exists (
    select 1 from timberforge.region_profile r
    where r.id = species.region_id
      and (r.is_builtin or r.owner_id = auth.uid())
  ));

create policy species_write on timberforge.species
  for all to authenticated
  using (exists (
    select 1 from timberforge.region_profile r
    where r.id = species.region_id
      and not r.is_builtin and r.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from timberforge.region_profile r
    where r.id = species.region_id
      and not r.is_builtin and r.owner_id = auth.uid()
  ));

-- -----------------------------------------------------------------------------
-- Cruise and membership
-- -----------------------------------------------------------------------------

create policy cruise_read on timberforge.cruise
  for select to authenticated
  using (
    owner_id = auth.uid()
    or exists (
      select 1 from timberforge.cruise_member m
      where m.cruise_id = cruise.id and m.user_id = auth.uid()
    )
  );
-- This one policy reads cruise_member directly rather than through a helper.
-- It is the base case of the recursion, and cruise_member's own policies are
-- written to reference `cruise` only via SECURITY DEFINER helpers, so the cycle
-- is broken on the other side.

create policy cruise_insert on timberforge.cruise
  for insert to authenticated
  with check (owner_id = auth.uid());

create policy cruise_update on timberforge.cruise
  for update to authenticated
  using (timberforge.can_write_cruise(id))
  with check (timberforge.can_write_cruise(id));
-- Ownership transfer is guarded by the trigger below, NOT by this WITH CHECK.
--
-- The obvious-looking `with check (owner_id = auth.uid())` is a privilege
-- escalation, and a nasty one, because it reads as though it prevents exactly
-- what it permits. A WITH CHECK sees only the NEW row. An editor running
-- `update cruise set owner_id = <themselves>` produces a new row whose owner_id
-- equals auth.uid(), so the check passes and the editor becomes the owner. From
-- there they can rewrite membership and delete the cruise. The clause blocks
-- only the one case nobody would try — handing the cruise to a third party.
--
-- A policy cannot see the OLD row, so this cannot be expressed as a policy at
-- all. It needs a trigger.

create or replace function timberforge.guard_cruise_owner_change()
returns trigger
language plpgsql
security definer
set search_path = timberforge, pg_temp
as $$
begin
  if new.owner_id is distinct from old.owner_id then
    -- auth.uid() is null for the service role and for migrations, and those
    -- paths are deliberately allowed to reassign — an admin restoring an
    -- orphaned cruise has to be able to. `is distinct from` keeps the null
    -- case from silently evaluating to false in the wrong direction.
    if auth.uid() is not null and old.owner_id is distinct from auth.uid() then
      raise exception
        'Only the current owner may transfer a cruise.'
        using errcode = 'insufficient_privilege',
              hint = 'An editor changing owner_id would gain member management '
                     'and delete rights, which is the whole editor/owner '
                     'distinction.';
    end if;
  end if;
  return new;
end;
$$;

create trigger cruise_owner_transfer_guard
  before update on timberforge.cruise
  for each row execute function timberforge.guard_cruise_owner_change();

-- -----------------------------------------------------------------------------
-- Handover
-- -----------------------------------------------------------------------------
-- Transferring a cruise needs its own function, for a reason that is not
-- obvious and was found by running the tests rather than by reading the SQL.
--
-- When a table has an UPDATE policy, Postgres ALSO applies the SELECT policy to
-- the new row as a WITH CHECK. The rule is "you may not update a row into a
-- state you would no longer be able to read", and it is a good rule — it stops
-- a user quietly pushing a row out of their own visibility. But it means that
-- an owner running
--
--     update cruise set owner_id = <somebody else>
--
-- is rejected with "new row violates row-level security policy", because the
-- moment owner_id changes, `cruise_read` no longer matches for them. The error
-- names the WITH CHECK, so it reads like a permissions bug in the policy above;
-- it is not. It is the SELECT policy, applied where you would not think to look
-- for it.
--
-- The workaround of leaving the outgoing owner a membership row works, but it
-- makes a clean handover impossible and it hides the ownership check in an
-- unrelated table. So handover is an explicit operation instead: one function,
-- one authorization check, running SECURITY DEFINER so that RLS is not in the
-- way of a transfer that has already been authorised.
create or replace function timberforge.transfer_cruise(
  p_cruise_id uuid,
  p_new_owner uuid
)
returns void
language plpgsql
security definer
set search_path = timberforge, pg_temp
as $$
declare
  v_old_owner uuid;
begin
  select owner_id into v_old_owner
  from timberforge.cruise
  where id = p_cruise_id;

  if v_old_owner is null then
    raise exception 'No such cruise: %', p_cruise_id
      using errcode = 'no_data_found';
  end if;

  -- auth.uid() is null for the service role and for migrations; those are
  -- allowed to reassign, which is how an orphaned cruise gets rescued.
  if auth.uid() is not null and v_old_owner is distinct from auth.uid() then
    raise exception 'Only the current owner may transfer a cruise.'
      using errcode = 'insufficient_privilege';
  end if;

  if not exists (select 1 from auth.users u where u.id = p_new_owner) then
    raise exception 'No such user: %', p_new_owner
      using errcode = 'foreign_key_violation';
  end if;

  -- The outgoing owner stays on as an editor. They collected the data; losing
  -- sight of their own field work the instant they hand the file over would be
  -- a surprise, and the new owner can remove them in one statement. Any
  -- existing role for them is left alone.
  if v_old_owner is not null and v_old_owner is distinct from p_new_owner then
    insert into timberforge.cruise_member (cruise_id, user_id, role, invited_by)
    values (p_cruise_id, v_old_owner, 'editor', v_old_owner)
    on conflict (cruise_id, user_id) do nothing;
  end if;

  update timberforge.cruise
  set owner_id = p_new_owner
  where id = p_cruise_id;
end;
$$;

comment on function timberforge.transfer_cruise(uuid, uuid) is
  'The supported way to hand a cruise to another user. A direct UPDATE of '
  'owner_id is rejected by the SELECT-policy-as-WITH-CHECK rule; see the '
  'comment above this function.';

create policy cruise_delete on timberforge.cruise
  for delete to authenticated
  using (owner_id = auth.uid());

create policy member_read on timberforge.cruise_member
  for select to authenticated
  using (user_id = auth.uid() or timberforge.owns_cruise(cruise_id));

create policy member_write on timberforge.cruise_member
  for all to authenticated
  using (timberforge.owns_cruise(cruise_id))
  with check (timberforge.owns_cruise(cruise_id));
-- Only the owner manages membership. An editor who could add members could
-- promote themselves to owner, which makes the editor/owner distinction
-- decorative.

-- -----------------------------------------------------------------------------
-- Field data
-- -----------------------------------------------------------------------------

create policy stand_read on timberforge.stand
  for select to authenticated using (timberforge.can_read_cruise(cruise_id));
create policy stand_write on timberforge.stand
  for all to authenticated
  using (timberforge.can_write_cruise(cruise_id))
  with check (timberforge.can_write_cruise(cruise_id));

create policy plot_read on timberforge.plot
  for select to authenticated
  using (timberforge.can_read_cruise(timberforge.cruise_of_stand(stand_id)));
create policy plot_write on timberforge.plot
  for all to authenticated
  using (timberforge.can_write_cruise(timberforge.cruise_of_stand(stand_id)))
  with check (timberforge.can_write_cruise(timberforge.cruise_of_stand(stand_id)));

create policy tree_read on timberforge.tree
  for select to authenticated
  using (timberforge.can_read_cruise(timberforge.cruise_of_plot(plot_id)));
create policy tree_write on timberforge.tree
  for all to authenticated
  using (timberforge.can_write_cruise(timberforge.cruise_of_plot(plot_id)))
  with check (timberforge.can_write_cruise(timberforge.cruise_of_plot(plot_id)));

create policy height_sample_read on timberforge.height_sample
  for select to authenticated
  using (timberforge.can_read_cruise(timberforge.cruise_of_tree(tree_id)));
create policy height_sample_write on timberforge.height_sample
  for all to authenticated
  using (timberforge.can_write_cruise(timberforge.cruise_of_tree(tree_id)))
  with check (timberforge.can_write_cruise(timberforge.cruise_of_tree(tree_id)));

-- -----------------------------------------------------------------------------
-- Compilations, QA, predictions
-- -----------------------------------------------------------------------------
-- No UPDATE policies on the append-only tables. The trigger from 0003 already
-- blocks updates for every role; omitting the policy as well means the API
-- refuses the write before it reaches the trigger, which produces a clearer
-- error than a raised exception.

create policy compilation_read on timberforge.compilation
  for select to authenticated using (timberforge.can_read_cruise(cruise_id));
create policy compilation_insert on timberforge.compilation
  for insert to authenticated with check (timberforge.can_write_cruise(cruise_id));
create policy compilation_delete on timberforge.compilation
  for delete to authenticated using (timberforge.owns_cruise(cruise_id));
-- Deleting a compilation is an owner-only act, and one that should be rare:
-- a superseded compilation is normally kept, not removed.

create policy qa_read on timberforge.qa_finding
  for select to authenticated using (timberforge.can_read_cruise(cruise_id));
create policy qa_insert on timberforge.qa_finding
  for insert to authenticated with check (timberforge.can_write_cruise(cruise_id));
create policy qa_update on timberforge.qa_finding
  for update to authenticated
  using (timberforge.can_write_cruise(cruise_id))
  with check (timberforge.can_write_cruise(cruise_id));
-- QA findings are updatable, unlike compilations, because acknowledging one is
-- a legitimate edit to an existing row rather than a rewriting of history.
create policy qa_delete on timberforge.qa_finding
  for delete to authenticated using (timberforge.owns_cruise(cruise_id));

create policy prediction_read on timberforge.prediction
  for select to authenticated using (timberforge.can_read_cruise(cruise_id));
create policy prediction_insert on timberforge.prediction
  for insert to authenticated with check (timberforge.can_write_cruise(cruise_id));
create policy prediction_delete on timberforge.prediction
  for delete to authenticated using (timberforge.owns_cruise(cruise_id));

-- -----------------------------------------------------------------------------
-- LandForge bridge
-- -----------------------------------------------------------------------------

create policy parcel_link_read on timberforge.parcel_link
  for select to authenticated using (timberforge.can_read_cruise(cruise_id));
create policy parcel_link_write on timberforge.parcel_link
  for all to authenticated
  using (timberforge.can_write_cruise(cruise_id))
  with check (timberforge.can_write_cruise(cruise_id));
-- Linking a cruise to a parcel checks write access on the CRUISE only. Whether
-- the user may see that PARCEL is LandForge's business, enforced by LandForge's
-- own policies on its own table; TimberForge should not attempt to second-guess
-- them from over here.

create policy timber_feed_read on timberforge.timber_feed
  for select to authenticated using (timberforge.can_read_cruise(cruise_id));
create policy timber_feed_insert on timberforge.timber_feed
  for insert to authenticated with check (timberforge.can_write_cruise(cruise_id));

-- -----------------------------------------------------------------------------
-- Grants
-- -----------------------------------------------------------------------------
-- RLS filters rows; grants decide whether the table is addressable at all. Both
-- are needed, and a missing grant presents as a confusing permission error
-- rather than as an empty result.

grant usage on schema timberforge to authenticated, service_role;

grant select on all tables in schema timberforge to authenticated;
grant insert, update, delete on
  timberforge.cruise, timberforge.cruise_member, timberforge.stand,
  timberforge.plot, timberforge.tree, timberforge.height_sample,
  timberforge.qa_finding, timberforge.region_profile, timberforge.species,
  timberforge.parcel_link
to authenticated;
grant insert, delete on
  timberforge.compilation, timberforge.prediction, timberforge.timber_feed
to authenticated;
-- No UPDATE grant on the append-only three, matching the missing policies.

grant all on all tables in schema timberforge to service_role;
grant execute on all functions in schema timberforge to authenticated, service_role;

-- Future tables in this schema inherit sensible defaults, so that a later
-- migration that forgets its grants is merely unreachable rather than open.
alter default privileges in schema timberforge
  grant select on tables to authenticated;
alter default privileges in schema timberforge
  grant all on tables to service_role;
