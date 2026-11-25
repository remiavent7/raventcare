-- CollectCare private beta: database setup for Supabase (Postgres).
-- Every table uses row-level security so each account can only read and write its own rows.
-- Sign-up is invite-only and is enforced inside the database, not just in the web page.

create extension if not exists pgcrypto;

-- ---------- Admins (founder) ----------
create table if not exists public.admins (
  user_id uuid primary key references auth.users on delete cascade,
  added_at timestamptz not null default now()
);
alter table public.admins enable row level security;
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid())
$$;
drop policy if exists admins_self on public.admins;
create policy admins_self on public.admins for select to authenticated using (user_id = auth.uid());

-- ---------- Invites ----------
create table if not exists public.invites (
  code text primary key check (code ~ '^[A-Z0-9-]{8,32}$'),
  note text check (length(note) <= 200),
  email text check (length(email) <= 254),
  max_uses int not null default 1 check (max_uses between 1 and 50),
  uses int not null default 0,
  expires_at timestamptz not null default now() + interval '30 days',
  revoked boolean not null default false,
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now()
);
alter table public.invites enable row level security;
drop policy if exists invites_admin_all on public.invites;
create policy invites_admin_all on public.invites for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create table if not exists public.invite_redemptions (
  code text not null references public.invites on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  redeemed_at timestamptz not null default now(),
  primary key (code, user_id)
);
alter table public.invite_redemptions enable row level security;
drop policy if exists redemptions_admin_read on public.invite_redemptions;
create policy redemptions_admin_read on public.invite_redemptions for select to authenticated using (public.is_admin());

-- Lets the sign-up form check a code before asking for a password. Returns only true/false.
create or replace function public.check_invite(p_code text, p_email text default null) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.invites i
    where i.code = upper(trim(p_code)) and not i.revoked and i.expires_at > now() and i.uses < i.max_uses
      and (i.email is null or p_email is null or lower(i.email) = lower(trim(p_email)))
  )
$$;
revoke all on function public.check_invite(text, text) from public;
grant execute on function public.check_invite(text, text) to anon, authenticated;

-- ---------- Profiles ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text check (length(display_name) <= 120),
  beta_terms_accepted_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
drop policy if exists profiles_own on public.profiles;
create policy profiles_own on public.profiles for all to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- ---------- Invite gate on sign-up ----------
create or replace function public.gate_signup() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  c text := upper(trim(coalesce(new.raw_user_meta_data->>'invite_code', '')));
  inv public.invites;
begin
  select * into inv from public.invites where code = c for update;
  if not found or inv.revoked or inv.expires_at <= now() or inv.uses >= inv.max_uses
     or (inv.email is not null and lower(inv.email) <> lower(new.email)) then
    raise exception 'INVITE_REQUIRED: a valid CollectCare invite code is required';
  end if;
  update public.invites set uses = uses + 1 where code = c;
  return new;
end $$;
drop trigger if exists gate_signup on auth.users;
create trigger gate_signup before insert on auth.users for each row execute function public.gate_signup();

create or replace function public.after_signup() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, beta_terms_accepted_at)
  values (new.id, left(new.raw_user_meta_data->>'display_name', 120),
          case when (new.raw_user_meta_data->>'beta_terms') = 'accepted' then now() end)
  on conflict (id) do nothing;
  insert into public.invite_redemptions (code, user_id)
  values (upper(trim(new.raw_user_meta_data->>'invite_code')), new.id) on conflict do nothing;
  return new;
end $$;
drop trigger if exists after_signup on auth.users;
create trigger after_signup after insert on auth.users for each row execute function public.after_signup();

-- ---------- Family members ----------
create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  full_name text not null check (length(full_name) between 1 and 120),
  relationship text not null default 'self' check (relationship in ('self','spouse','partner','child','parent','sibling','other')),
  birth_date date,
  notes text check (length(notes) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists members_owner on public.members(owner_id);
alter table public.members enable row level security;
drop policy if exists members_own on public.members;
create policy members_own on public.members for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ---------- Health items (insurance, doctors, medications, allergies, conditions, vaccines, visits, notes) ----------
create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  member_id uuid not null references public.members on delete cascade,
  kind text not null check (kind in ('insurance','doctor','medication','allergy','condition','vaccine','visit','note')),
  data jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object' and pg_column_size(data) < 16000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists items_member on public.items(member_id);
alter table public.items enable row level security;
drop policy if exists items_own on public.items;
create policy items_own on public.items for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid() and exists (select 1 from public.members m where m.id = member_id and m.owner_id = auth.uid()));

-- ---------- Documents (files live in the private storage bucket) ----------
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  member_id uuid not null references public.members on delete cascade,
  name text not null check (length(name) between 1 and 200),
  mime text check (length(mime) <= 100),
  size_bytes int check (size_bytes between 0 and 10485760),
  storage_path text not null unique,
  created_at timestamptz not null default now()
);
alter table public.documents enable row level security;
drop policy if exists documents_own on public.documents;
create policy documents_own on public.documents for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid()
              and split_part(storage_path, '/', 1) = auth.uid()::text
              and exists (select 1 from public.members m where m.id = member_id and m.owner_id = auth.uid()));

-- ---------- Activity log (the account holder's own history) ----------
create table if not exists public.activity (
  id bigint generated always as identity primary key,
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  at timestamptz not null default now(),
  action text not null check (length(action) <= 60),
  detail text check (length(detail) <= 300)
);
alter table public.activity enable row level security;
drop policy if exists activity_read on public.activity;
drop policy if exists activity_add on public.activity;
create policy activity_read on public.activity for select to authenticated using (owner_id = auth.uid());
create policy activity_add on public.activity for insert to authenticated with check (owner_id = auth.uid());

-- ---------- updated_at ----------
create or replace function public.touch() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists members_touch on public.members;
create trigger members_touch before update on public.members for each row execute function public.touch();
drop trigger if exists items_touch on public.items;
create trigger items_touch before update on public.items for each row execute function public.touch();

-- ---------- Table privileges: nothing for signed-out visitors ----------
revoke all on public.admins, public.invites, public.invite_redemptions, public.profiles,
              public.members, public.items, public.documents, public.activity from anon;
grant select, insert, update, delete on public.invites, public.profiles, public.members, public.items, public.documents to authenticated;
grant select on public.admins, public.invite_redemptions to authenticated;
grant select, insert on public.activity to authenticated;

-- ---------- Admin view of beta accounts: counts only, never health data ----------
create or replace function public.admin_beta_accounts()
returns table (email text, display_name text, joined timestamptz, last_sign_in timestamptz, confirmed boolean, invite_code text, family_members bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  return query
    select u.email::text, p.display_name, u.created_at, u.last_sign_in_at, (u.email_confirmed_at is not null),
           (select r.code from public.invite_redemptions r where r.user_id = u.id limit 1),
           (select count(*) from public.members m where m.owner_id = u.id)
    from auth.users u left join public.profiles p on p.id = u.id
    order by u.created_at desc;
end $$;
revoke all on function public.admin_beta_accounts() from public;
grant execute on function public.admin_beta_accounts() to authenticated;

-- ---------- Delete my account (files are removed by the app first) ----------
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  delete from auth.users where id = auth.uid();
end $$;
revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;

-- ---------- Private file storage ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('family-files', 'family-files', false, 10485760,
        array['application/pdf','image/jpeg','image/png','image/heic','image/heif','image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists family_files_read on storage.objects;
drop policy if exists family_files_add on storage.objects;
drop policy if exists family_files_remove on storage.objects;
create policy family_files_read on storage.objects for select to authenticated
  using (bucket_id = 'family-files' and (storage.foldername(name))[1] = auth.uid()::text);
create policy family_files_add on storage.objects for insert to authenticated
  with check (bucket_id = 'family-files' and (storage.foldername(name))[1] = auth.uid()::text);
create policy family_files_remove on storage.objects for delete to authenticated
  using (bucket_id = 'family-files' and (storage.foldername(name))[1] = auth.uid()::text);
