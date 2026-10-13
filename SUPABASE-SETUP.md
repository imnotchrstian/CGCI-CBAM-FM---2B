# Shared portal setup

The portal uses Supabase Auth and Postgres. Do not put a service-role key in the website. The browser uses only the project's publishable/anon key; admin-only account operations run through the protected Edge Function.

## Current deployment

The database schema is applied to the connected project, the `admin-manage-student` Edge Function is deployed, and GitHub Pages is configured. If recreating the project, run `supabase/schema.sql` once in the Supabase SQL Editor.

## Browser configuration

`supabase-config.js` contains the project's public Project URL and publishable key. These settings are expected to be visible in the browser. Never put a `service_role` or secret key there.

## First administrator

The first account starts as a pending student so it can be created through Supabase Auth. After registering and confirming its email, run this once in the Supabase SQL Editor, replacing the email:

```sql
update public.profiles
set role = 'admin', approved = true
where email = lower('ADMIN_EMAIL_ADDRESS');
```

Use the same email and password on the Administrator Login tab. Keep the password private.

## Authentication and access

The Supabase Site URL and allowed redirect URL are set to the GitHub Pages site. Student self-signups are pending until an administrator approves them. Row-level security limits approved students to their own grades. The admin Edge Function verifies the caller's authenticated profile is an admin before account creation/deletion; its privileged key stays server-side in Supabase's built-in secret environment.

## Data safety

Registrations and grades are now shared through Supabase. Keep row-level security enabled and use a unique admin password. Any records that existed in browser `localStorage` were not uploaded automatically; importing them requires a deliberate migration.
