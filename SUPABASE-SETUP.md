# Shared portal setup

The portal uses Supabase Auth and Postgres. Do not put a service-role key in the website. The browser uses only the project's publishable/anon key; admin-only account operations run through the protected Edge Function.

## Current deployment

The database schema is applied to the connected project, the `admin-manage-student` Edge Function is deployed, and GitHub Pages is configured. If recreating the project, run `supabase/schema.sql` once in the Supabase SQL Editor.

## Browser configuration

`supabase-config.js` contains the project's public Project URL and publishable key. These settings are expected to be visible in the browser. Never put a `service_role` or secret key there.

## Administrator login

The administrator profile is configured as **Honey Grace Capili**. The portal's administrator tab accepts the administrator name and password; Supabase uses an internal account identifier behind the scenes. Students continue to sign in with their own email and password. Keep the administrator password private and replace it if it has been shared.

## Authentication and access

The Supabase Site URL and allowed redirect URL are set to the GitHub Pages site. Student self-signups are pending until an administrator approves them. Row-level security limits approved students to their own grades. The admin Edge Function verifies the caller's authenticated profile is an admin before account creation/deletion; its privileged key stays server-side in Supabase's built-in secret environment.

## Data safety

Registrations and grades are now shared through Supabase. Keep row-level security enabled and use a unique admin password. Any records that existed in browser `localStorage` were not uploaded automatically; importing them requires a deliberate migration.
