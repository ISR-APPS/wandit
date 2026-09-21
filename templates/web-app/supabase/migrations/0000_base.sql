-- Base schema for the generated app. WANDIT-183 applies it at provisioning.
-- Enables pg_cron for scheduled jobs and creates the profiles table
-- with row-level security so each user owns exactly one row.

create extension if not exists pg_cron;

create table if not exists public.profiles (
	id uuid primary key references auth.users (id) on delete cascade,
	full_name text,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own"
	on public.profiles for select
	using (auth.uid() = id);

create policy "profiles_insert_own"
	on public.profiles for insert
	with check (auth.uid() = id);

create policy "profiles_update_own"
	on public.profiles for update
	using (auth.uid() = id)
	with check (auth.uid() = id);
