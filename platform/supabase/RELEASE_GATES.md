# Bizlano: Firebase / D1 / R2 to Supabase cutover

Status (2026-11-11): **NOT DEPLOYED. NO DATA MOVED.** This is a guarded implementation handoff, not a completed migration.

## Verified blockers
- Live Bizlano `/app` authenticates with Firebase project `metaforge-6afdf` and uses verified Firebase ID tokens at the Cloudflare Worker. Its application data is stored in Bizlano's dedicated Cloudflare D1; logos/files are stored in its R2. The standalone `business-react/` source is NOT the frontend served at `/app`.
- Connected Supabase project `Metaaforge` (`apyiknbiibdmatqkpjov`) is INACTIVE. Attempt to restore returned Supabase free-project limit (two active free projects on its account). Do not pause/delete `Gwebstore`, `slt-tradehub`, or any other unrelated project to bypass that limit.
- Project name alone is not proof of ownership of legacy data. Audit the restored project BEFORE any schema writes. Do not use other clients' projects.
- Existing Firebase users cannot have their passwords pulled from Firebase client auth. Do not silently recreate accounts by email or use a UID/email submitted by a browser as authorization.

## Required implementation sequence

1. Obtain a dedicated active Supabase project in the correct organization, with a verified owner, project URL, publishable key and a Worker-only secret key. Use the secret key only in the server's private runtime; never commit it.
2. Inspect the live D1 schema and all migration versions (0001-0008), plus live row counts and foreign keys; make a private encrypted export of every tenant, user link, membership, invitation, customer, product, document, line, payment, stock event, expense, target, audit event, design, integration, customer recovery code and receipt claim. Backup R2 logos and private objects. Do not export Firebase passwords.
3. Create a **new** PostgreSQL schema with explicit tenant keys, correct FK relationships, numeric minor-unit financial amounts, CHECK constraints, unique idempotency keys, and RLS on every exposed table. Use Supabase Auth UUIDs as authenticated principals and a separately verified `firebase_uid -> auth.uid()` bridge. Do not treat user-editable JWT metadata as an authority. Audit via security advisors.
4. Port D1 SQL behavior into Postgres transactions / triggers / privileged server RPCs. Money received must remain append-only; issued documents and marketplace events must not be silently mutated. Atomic stock validation, draft issue/void, receipt claims and payment reconciliations need parity tests. PostgreSQL DDL is not SQLite DDL; **do not execute the existing D1 migrations unchanged**.
5. Port the Cloudflare Worker API (not only the browser) to verified Supabase JWTs and Postgres. Keep all tenant/member role checks SERVER-SIDE; test owner, admin, manager, accountant, cashier, sales, viewer, nonmember, suspended and cross-tenant access. Retain existing `/api` routes until clients are upgraded and checked.
6. Switch live frontend registration, sign-in, sign-out, forgot/reset password, email confirmation, invitation acceptance, session refresh, user account recovery and customer receipt inbox to Supabase Auth. Users must affirmatively verify account ownership; consider staged account linking or password reset. Preserve customer access without forcing business creation.
7. Import data from **verified** source exports with idempotent crosswalk tables, dry runs, counts, checksums, orphan detection and financial reconciliation. Keep old receipt URLs working during cutover, without opening private records to unauthenticated users.
8. Migrate all uploaded objects to private Supabase Storage with tenant-aware authorization and signed download URLs. Preserve original object hashes and backup R2 until verified.
9. Run a test suite and full browser walkthrough on mobile and desktop, including account creation, sign-in/out, forgotten password, email verification, owner/staff invite, issued receipt, inventory decrement, partial payment, void, customer inbox, recovery claim, printing, old-user migration, and cross-business isolation.
10. Switch production only after a proven rollback path, fully reconciled records, and owner sign-off. Keep Firebase, D1, R2 and old receipt links read-only / available until their decommission is explicitly approved.

## Release acceptance checklist
- [ ] Dedicated Supabase database ACTIVE; access confirmed.
- [ ] Source D1 + Firebase ownership records + R2 objects backed up, counts captured.
- [ ] PostgreSQL schema and RLS independently tested.
- [ ] Supabase Auth replaces ALL Firebase user journeys (including customer receipt recovery).
- [ ] Worker verifies Supabase JWTs; no service-role credential reaches browser.
- [ ] Owner/staff access and tenant isolation verified by negative tests.
- [ ] Documents, line items, stock, payments, expenses and target totals reconcile.
- [ ] Document links and receipt recovery remain valid.
- [ ] Mobile and desktop end-to-end flows verified in browser.
- [ ] Production cutover and rollback exercised, with user approval.

**Do not falsely mark the above as done based on a commit or a working marketing page.**

Relevant originals:
- `platform/worker/client.js`, `platform/worker/worker.js`, `platform/worker/customer.js`
- `platform/migrations/0001_multitenant.sql` ... `0008_phone_signin_alias.sql`
- `business-react/src/cloud.ts`, `business-react/src/App.tsx`
- `platform/BIZLANO_TRANSITION.md`
