-- Base schema for the generated app. WANDIT-183 applies it at provisioning.
-- Enables pg_cron for scheduled jobs and creates the profiles table
-- with row-level security so each user owns exactly one row.
-- The last part creates the app access: public.app_access and the schema private.
-- Every statement can run twice: a retried provisioning applies it again.

create extension if not exists pg_cron;

create table if not exists public.profiles (
	id uuid primary key references auth.users (id) on delete cascade,
	full_name text,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
	on public.profiles for select
	using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
	on public.profiles for insert
	with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
	on public.profiles for update
	using (auth.uid() = id)
	with check (auth.uid() = id);

-- App access: the first account with a confirmed email is the owner. Each later account waits for the owner.
-- `private` is not an exposed API schema, so no client can call its functions through the API.
create schema if not exists private;
grant usage on schema private to anon, authenticated;

-- One optional row. No row means audience 'team'.
-- 'team': approved accounts share all business rows. 'public': each account has its own rows.
create table if not exists private.app_config (
	singleton boolean primary key default true check (singleton),
	audience text not null default 'team' check (audience in ('team', 'public'))
);

create table if not exists public.app_access (
	user_id uuid primary key references auth.users (id) on delete cascade,
	-- Copy of auth.users.email when the row is written, for the list that the owner reads.
	email text not null,
	role text not null default 'member' check (role in ('owner', 'member')),
	status text not null default 'pending' check (status in ('pending', 'approved', 'refused')),
	requested_at timestamptz not null default now()
);
-- Backstop: the database refuses a second owner row.
create unique index if not exists app_access_one_owner on public.app_access ((true)) where role = 'owner';
alter table public.app_access enable row level security;
-- Supabase grants all on new public tables to these roles. Keep select, and update of one column.
revoke all on table public.app_access from anon, authenticated;
grant select, update (status) on table public.app_access to authenticated;

-- This statement gives a row to each confirmed account from before this file.
-- The trigger below runs only on a later insert or a later confirmation.
-- When the table is empty, the oldest confirmed account is the owner. Each other account waits for the owner.
-- Keep this statement before the trigger. With the trigger first, an account confirmed during the run takes the owner role.
insert into public.app_access (user_id, email, role, status)
select
	id,
	coalesce(email, ''),
	case when is_first_account then 'owner' else 'member' end,
	case when is_first_account then 'approved' else 'pending' end
from (
	select
		id,
		email,
		row_number() over (order by created_at, id) = 1
			and not exists (select 1 from public.app_access) as is_first_account
	from auth.users
	-- An anonymous session is not a person who signed up.
	where not is_anonymous
		-- An unconfirmed account gets no row here. The trigger gives the row at the confirmation.
		and email_confirmed_at is not null
) as account
on conflict (user_id) do nothing;

create or replace function private.handle_new_app_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
	-- An anonymous session is not a person who signed up. It never takes the owner role.
	if new.is_anonymous then return new; end if;
	-- An account gets no row before Supabase Auth confirms its email. An unconfirmed address never takes the owner role.
	if new.email_confirmed_at is null then return new; end if;
	-- The trigger also runs on each later update of the column. An account keeps the row that it has.
	if exists (select 1 from public.app_access where user_id = new.id) then return new; end if;
	-- One account at a time, so only one transaction sees an empty table.
	perform pg_advisory_xact_lock(hashtext('app_access_first_owner'));
	-- Only the first confirmed account of the app is the owner. When the owner account is gone,
	-- a new account takes the owner role only if the table is empty.
	if not exists (select 1 from public.app_access) then
		insert into public.app_access (user_id, email, role, status)
		values (new.id, coalesce(new.email, ''), 'owner', 'approved');
	elsif exists (select 1 from private.app_config where audience = 'public') then
		insert into public.app_access (user_id, email, status)
		values (new.id, coalesce(new.email, ''), 'approved');
	else
		insert into public.app_access (user_id, email)
		values (new.id, coalesce(new.email, ''));
	end if;
	return new;
end $$;
revoke execute on function private.handle_new_app_user() from public, anon, authenticated;
-- `create or replace` needs only the TRIGGER privilege. `drop trigger` needs table ownership.
-- Keep the name `app_access_on_sign_up`. A new name leaves the old insert trigger on a database that has it.
-- Supabase Auth inserts an account with no confirmation time. A later update sets the column.
-- With autoconfirm, the update is in the same transaction. Else, it runs when the person confirms the email.
-- The insert event stays for a seed or an import that writes the confirmation time in one insert.
create or replace trigger app_access_on_sign_up after insert or update of email_confirmed_at on auth.users
	for each row execute function private.handle_new_app_user();

-- Helpers for RLS. security definer: they read app_access as the table owner, so no policy recursion.
-- is_app_owner uses `exists`, so an account with no row gets false, never null.
create or replace function private.is_app_owner() returns boolean
language sql stable security definer set search_path = '' as $$
	select exists (select 1 from public.app_access where user_id = (select auth.uid()) and role = 'owner');
$$;
-- The id that owns the business rows the caller can use. Null when the caller is not approved.
-- 'team': the id of the app owner. 'public': the id of the caller.
create or replace function private.data_owner_id() returns uuid
language sql stable security definer set search_path = '' as $$
	select case
		when not exists (
			select 1 from public.app_access where user_id = (select auth.uid()) and status = 'approved'
		) then null
		when exists (select 1 from private.app_config where audience = 'public') then (select auth.uid())
		else (select user_id from public.app_access where role = 'owner')
	end;
$$;
revoke execute on function private.is_app_owner(), private.data_owner_id() from public, anon, authenticated;
grant execute on function private.is_app_owner(), private.data_owner_id() to anon, authenticated;

drop policy if exists app_access_select on public.app_access;
create policy app_access_select on public.app_access for select to authenticated
	using (user_id = (select auth.uid()) or (select private.is_app_owner()));
-- The owner approves or refuses an account. The owner row itself never changes.
-- A policy does this work, so the exposed schema holds no security definer function.
drop policy if exists app_access_decide on public.app_access;
create policy app_access_decide on public.app_access for update to authenticated
	using ((select private.is_app_owner()) and role <> 'owner')
	with check (status in ('approved', 'refused'));
-- No insert or delete policy and no such grant. Only the trigger on auth.users and the statement for old accounts insert a row.
