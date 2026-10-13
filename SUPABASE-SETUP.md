# Shared portal setup

The portal uses Supabase Auth and Postgres. Do not put a service-role key in the website. The browser uses only the project's publishable/anon key; admin-only account operations run through the protected Edge Function.

## 1. Create the database

In Supabase, open SQL Editor and run `supabase/schema.sql`.

## 2. Connect the browser app

In Project Settings > API, copy the Project URL and publishable key (or legacy anon key) into `supabase-config.js`:

```js
window.CBAM_SUPABASE_CONFIG = {
  url: "https://YOUR_PROJECT_REF.supabase.co",
  publishableKey: "YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY",
};
```

These values are public browser settings. Never use the `service_role` key here.

## 3. Create the first administrator

Use the portal's student registration form once with the administrator's name, section, codename, email, and password. Confirm the email if Supabase requires it. In Supabase SQL Editor, promote that account:

```sql
update public.profiles
set role = 'admin', approved = true
where email = lower('ADMIN_EMAIL_ADDRESS');
```

Use that email and password on the Administrator Login tab. Do not expose the admin password in the repository.

## 4. Deploy administrator account management

Install the Supabase CLI, sign in, link this project, and deploy the function from the repository root:

```sh
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase functions deploy admin-manage-student
```

The function uses Supabase's server-side `SUPABASE_SERVICE_ROLE_KEY` environment secret. It verifies the caller's authenticated profile is an admin before creating or deleting any student account. Never add this secret to `supabase-config.js` or the repository.

## 5. Configure email and test

In Supabase Authentication settings, configure the allowed site URL and email confirmation behavior. Add the GitHub Pages URL to the allowed redirect/site URLs. Test with separate student and administrator accounts: a student signup should remain pending until approved, and approved students should only read their own grades.

## Data safety

Supabase is shared storage; unlike the old localStorage demo, registrations and grades are shared between visitors. Keep row-level security enabled and use a unique admin password. The existing `localStorage` records are not uploaded automatically. Export and import workflow needs a deliberate migration if you have records you need to keep.
