# Shared portal setup

The portal uses Supabase Auth and Postgres. Do not put a service-role key in the website. The browser uses only the project's publishable/anon key; admin-only account operations run through the protected Edge Function.

## Current deployment

The database schema is applied to the connected project, the `admin-manage-student` Edge Function is deployed, and GitHub Pages is configured. If recreating the project, run `supabase/schema.sql` once in the Supabase SQL Editor.

## Browser configuration

`supabase-config.js` contains the project's public Project URL and publishable key. These settings are expected to be visible in the browser. Never put a `service_role` or secret key there.

## Administrator login

The administrator profile is configured as **Honey Grace Capili**. The portal's administrator tab accepts the administrator name and password; Supabase uses an internal account identifier behind the scenes. Keep the administrator password private and replace it if it has been shared.

Students register with full name, section, and codename and are sent straight to their dashboard; later they sign in with codename and section. This is intentionally simpler, but it is not strong authentication: anyone who knows or guesses both values can access that student's shared grades.

## Authentication and access

The public student registration function creates an active profile, and student login matches codename and section before returning that student's grades. Anyone who learns both values can impersonate that student. Administrator-only account creation, approval, and deletion verify the caller's authenticated admin profile, and the privileged key stays server-side in Supabase's built-in secret environment.

## Data safety

Registrations and grades are now shared through Supabase. Keep row-level security enabled and use a unique admin password. Any records that existed in browser `localStorage` were not uploaded automatically; importing them requires a deliberate migration.
