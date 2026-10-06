-- The P House: Supabase setup. Paste into Supabase > SQL Editor > New query, then Run.
-- Safe to run more than once, including on top of the earlier version.

-- 1. One row that holds all site content (products, prices, promos, text, test runs)
create table if not exists public.site_config (
  id int primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.site_config enable row level security;

-- Public can only READ. All writes go through the site functions using the secret key.
drop policy if exists "site_config read" on public.site_config;
create policy "site_config read" on public.site_config
  for select to anon, authenticated using (true);

drop policy if exists "site_config insert" on public.site_config;
drop policy if exists "site_config update" on public.site_config;

-- 2. Public picture bucket named "media". Public can only read pictures.
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do update set public = true;

drop policy if exists "media read" on storage.objects;
create policy "media read" on storage.objects
  for select to anon, authenticated using (bucket_id = 'media');

drop policy if exists "media insert" on storage.objects;
drop policy if exists "media update" on storage.objects;
drop policy if exists "media delete" on storage.objects;
