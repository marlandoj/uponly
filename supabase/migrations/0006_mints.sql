-- 0006: soulbound mint records.
--
-- One row per (user, badge). The DB badge (0004) is the source of truth for
-- "earned"; this table records the mint attempt. backend = 'simulated' until
-- the Wednesday go/no-go flips MINT_BACKEND=onchain; simulated rows are
-- clearly labelled and carry no tx_hash.

create table public.mints (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  badge      text not null check (badge in ('first_fold')),
  backend    text not null check (backend in ('simulated', 'onchain')),
  address    text not null check (address ~ '^0x[0-9a-fA-F]{40}$'),
  tx_hash    text check (tx_hash ~ '^0x[0-9a-fA-F]{64}$'),
  created_at timestamptz not null default now(),
  primary key (user_id, badge)
);

alter table public.mints enable row level security;

-- Owners read their own mint records.
create policy "mints: owner read"
  on public.mints for select to authenticated
  using (user_id = (select auth.uid()));

-- No direct writes: the mint service (SECURITY DEFINER RPC below) owns them.
revoke all on table public.mints from anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- record_mint: idempotent insert called by the server-side mint service.
-- ---------------------------------------------------------------------------
create or replace function public.record_mint(
  p_user_id uuid,
  p_badge   text,
  p_backend text,
  p_address text,
  p_tx_hash text default null
)
returns public.mints
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mint public.mints;
begin
  insert into public.mints (user_id, badge, backend, address, tx_hash)
  values (p_user_id, p_badge, p_backend, p_address, p_tx_hash)
  on conflict (user_id, badge) do nothing
  returning * into v_mint;

  if v_mint.user_id is null then
    select * into v_mint from public.mints
     where user_id = p_user_id and badge = p_badge;
  end if;
  return v_mint;
end;
$$;
