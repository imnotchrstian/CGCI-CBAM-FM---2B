create extension if not exists pgcrypto;

create type public.portal_role as enum ('admin', 'student');

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  role public.portal_role not null default 'student',
  full_name text not null check (length(trim(full_name)) between 1 and 120),
  section text not null check (length(trim(section)) between 1 and 80),
  codename text unique,
  approved boolean not null default false,
  registration_source text not null default 'student' check (registration_source in ('student', 'administrator')),
  created_by uuid references public.profiles(user_id),
  created_at timestamptz not null default now(),
  check (role <> 'student' or codename is not null)
);

create table public.grades (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(user_id) on delete cascade,
  subject text not null check (length(trim(subject)) between 1 and 120),
  period text not null check (period in ('Prelim', 'Midterm', 'Pre-Final', 'Final')),
  grade numeric(5,2) not null check (grade between 0 and 100),
  remarks text not null default '',
  created_at timestamptz not null default now(),
  unique (student_id, subject, period)
);

create or replace function public.current_portal_role()
returns public.portal_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role from public.profiles p where p.user_id = (select auth.uid())
$$;

create or replace function public.is_approved_student()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.user_id = (select auth.uid())
      and p.role = 'student'
      and p.approved = true
  )
$$;

alter table public.profiles enable row level security;
alter table public.grades enable row level security;

create policy "Users read own profile; admins read all profiles"
on public.profiles for select to authenticated
using (user_id = (select auth.uid()) or public.current_portal_role() = 'admin');

create policy "Students create unapproved own profile"
on public.profiles for insert to authenticated
with check (
  user_id = (select auth.uid())
  and role = 'student'
  and approved = false
);

create policy "Admins manage profiles"
on public.profiles for all to authenticated
using (public.current_portal_role() = 'admin')
with check (public.current_portal_role() = 'admin');

create policy "Students read own grades; admins read all grades"
on public.grades for select to authenticated
using (
  public.current_portal_role() = 'admin'
  or (public.is_approved_student() and student_id = (select auth.uid()))
);

create policy "Admins manage grades"
on public.grades for all to authenticated
using (public.current_portal_role() = 'admin')
with check (public.current_portal_role() = 'admin');

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.grades to authenticated;
grant execute on function public.current_portal_role() to authenticated;
grant execute on function public.is_approved_student() to authenticated;

create index grades_student_id_idx on public.grades(student_id);
create index profiles_role_approved_idx on public.profiles(role, approved);

create or replace function public.create_student_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, email, role, full_name, section, codename, approved, registration_source)
  values (
    new.id,
    lower(new.email),
    'student',
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'section', ''),
    upper(coalesce(new.raw_user_meta_data ->> 'codename', '')),
    false,
    'student'
  );
  return new;
end;
$$;

create trigger on_auth_user_created_student_profile
after insert on auth.users
for each row execute function public.create_student_profile();
