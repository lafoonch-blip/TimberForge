# Parcel — the shared record

**Owner:** LandForge · **Mirror status: PENDING — not yet captured.** · **This file is a placeholder.**

Parcel is the one entity both products genuinely share. It is LandForge's concept: LandForge identifies parcels, pays for the geometry and ownership lookups, and holds the canonical row. TimberForge attaches cruises to parcels by foreign key and copies nothing.

## Why nothing is written here yet

`PARCEL_HIT` — the variable holding the selected parcel — was `null` at capture time, because no parcel had been selected in the session. Selecting one in the LandForge UI populates it and exposes the real field names and types.

Writing a plausible schema here from the intake form's labels would be exactly the mistake this directory exists to prevent: a guess, mirrored, that later reads as fact.

## What depends on this

`supabase/migrations/0004_landforge_bridge.sql` attaches a **conditional** foreign key from `timberforge.parcel_link` to LandForge's parcel table. It discovers the table by configured name and refuses to bind if it cannot positively identify it — printing candidates and skipping rather than attaching to something that merely looks plausible. A wrong bind would join cruises to the wrong parcels and every downstream number would be quietly incorrect.

Until this file is filled in, that migration runs in skip mode against the real project. The two variables to set once the schema is known are `parcel_table` and `parcel_schema` in the final `DO` block.

## To capture

1. Select a parcel in LandForge `/beta`.
2. Read `PARCEL_HIT` — record field names, types, and which field is the primary key.
3. Confirm the key is a `uuid`; migration `0004` explicitly refuses to bind to a non-uuid key and there is a test pinning that refusal.
4. Record the schema and table name.
5. Fill in this file, update `mirror.manifest.json` (`confidence: "confirmed"`, new `capturedAt`), and run `npm run check:mirror -- --update`.

## Fields

*Not yet captured.*
