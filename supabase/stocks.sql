-- ============================================================
-- Friend Stock Market — schema, RLS, pricing helpers, RPCs
-- Run in Supabase SQL Editor AFTER schema.sql + addons.sql
--
-- Pricing: linear bonding curve. The cost/proceeds math here is the
-- source of truth and is mirrored in lib/stockMarket.ts for client previews.
-- ============================================================

-- ── Admin flag (used to apply events without confirmations) ──
alter table public.profiles
  add column if not exists is_admin boolean not null default false;

-- ── Tables ───────────────────────────────────────────────────

create table if not exists public.stocks (
  id                 uuid primary key default gen_random_uuid(),
  profile_id         uuid not null unique references public.profiles(id) on delete cascade,
  ticker             text not null unique,
  base_price         float8 not null default 10,
  slope              float8 not null default 0.5,
  shares_outstanding integer not null default 0,
  treasury           integer not null default 0,
  tradable           boolean not null default true,
  created_at         timestamptz not null default now()
);

create table if not exists public.stock_trades (
  id         uuid primary key default gen_random_uuid(),
  stock_id   uuid not null references public.stocks(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  side       text not null check (side in ('buy','sell')),
  shares     integer not null check (shares > 0),
  cost       integer not null,          -- points in (buy) / out (sell), net of fee
  fee        integer not null default 0,
  spot_after float8 not null,           -- price after trade (for charting)
  created_at timestamptz not null default now()
);

create index if not exists stock_trades_stock_idx on public.stock_trades(stock_id, created_at);

create table if not exists public.stock_holdings (
  stock_id  uuid not null references public.stocks(id) on delete cascade,
  user_id   uuid not null references public.profiles(id) on delete cascade,
  shares    integer not null default 0 check (shares >= 0),
  primary key (stock_id, user_id)
);

create table if not exists public.stock_events (
  id                 uuid primary key default gen_random_uuid(),
  stock_id           uuid not null references public.stocks(id) on delete cascade,
  proposed_by        uuid not null references public.profiles(id),
  type               text not null,
  label              text not null check (char_length(label) <= 140),
  multiplier         float8 not null default 1 check (multiplier > 0 and multiplier <= 5),
  dividend_per_share integer not null default 0 check (dividend_per_share >= 0),
  status             text not null default 'pending'
                       check (status in ('pending','applied','rejected')),
  applied_at         timestamptz,
  created_at         timestamptz not null default now()
);

create table if not exists public.stock_event_confirmations (
  event_id  uuid not null references public.stock_events(id) on delete cascade,
  user_id   uuid not null references public.profiles(id) on delete cascade,
  vote      smallint not null default 1 check (vote in (-1, 1)),
  primary key (event_id, user_id)
);

-- ── Row Level Security (read-all; writes via RPC only) ───────

alter table public.stocks                    enable row level security;
alter table public.stock_trades              enable row level security;
alter table public.stock_holdings            enable row level security;
alter table public.stock_events              enable row level security;
alter table public.stock_event_confirmations enable row level security;

create policy "Anyone can read stocks"        on public.stocks for select using (true);
create policy "Anyone can read stock_trades"  on public.stock_trades for select using (true);
create policy "Anyone can read holdings"      on public.stock_holdings for select using (true);
create policy "Anyone can read events"        on public.stock_events for select using (true);
create policy "Anyone can read confirmations" on public.stock_event_confirmations for select using (true);

-- ── Pricing helpers (mirror lib/stockMarket.ts) ──────────────

create or replace function public.stock_buy_cost(base float8, slope float8, s integer, n integer)
returns float8 language sql immutable as $$
  select base * n + (slope * n * (2 * s + n)) / 2.0
$$;

create or replace function public.stock_sell_proceeds(base float8, slope float8, s integer, n integer)
returns float8 language sql immutable as $$
  select base * n + (slope * n * (2 * s - n)) / 2.0
$$;

-- ── RPC: buy_stock ───────────────────────────────────────────

create or replace function public.buy_stock(p_stock_id uuid, p_shares integer)
returns integer
language plpgsql security definer
as $$
declare
  v_user_id uuid := auth.uid();
  v_base float8; v_slope float8; v_out integer; v_tradable boolean;
  v_ticker text;
  v_raw float8; v_cost integer; v_fee integer; v_total integer;
  v_balance integer; v_new_out integer;
begin
  if p_shares <= 0 then raise exception 'Shares must be positive'; end if;

  select base_price, slope, shares_outstanding, tradable, ticker
    into v_base, v_slope, v_out, v_tradable, v_ticker
    from public.stocks where id = p_stock_id for update;
  if not found then raise exception 'Stock not found'; end if;
  if not v_tradable then raise exception 'This stock is not tradable'; end if;

  v_raw  := public.stock_buy_cost(v_base, v_slope, v_out, p_shares);
  v_cost := round(v_raw);
  v_fee  := round(v_raw * 100 / 10000);   -- 1% fee
  v_total := v_cost + v_fee;

  select points_balance into v_balance from public.profiles where id = v_user_id for update;
  if v_balance < v_total then raise exception 'Insufficient points'; end if;

  v_new_out := v_out + p_shares;

  update public.profiles set points_balance = points_balance - v_total where id = v_user_id;
  update public.stocks
     set shares_outstanding = v_new_out, treasury = treasury + v_fee
   where id = p_stock_id;

  insert into public.stock_holdings (stock_id, user_id, shares)
  values (p_stock_id, v_user_id, p_shares)
  on conflict (stock_id, user_id) do update set shares = stock_holdings.shares + p_shares;

  insert into public.stock_trades (stock_id, user_id, side, shares, cost, fee, spot_after)
  values (p_stock_id, v_user_id, 'buy', p_shares, v_total, v_fee, v_base + v_slope * v_new_out);

  insert into public.transactions (user_id, amount, reason)
  values (v_user_id, -v_total, 'Bought ' || p_shares || ' shares of $' || v_ticker);

  return v_total;
end;
$$;

-- ── RPC: sell_stock ──────────────────────────────────────────

create or replace function public.sell_stock(p_stock_id uuid, p_shares integer)
returns integer
language plpgsql security definer
as $$
declare
  v_user_id uuid := auth.uid();
  v_base float8; v_slope float8; v_out integer; v_tradable boolean;
  v_ticker text;
  v_held integer; v_raw float8; v_proceeds integer; v_fee integer; v_net integer;
  v_new_out integer;
begin
  if p_shares <= 0 then raise exception 'Shares must be positive'; end if;

  select base_price, slope, shares_outstanding, tradable, ticker
    into v_base, v_slope, v_out, v_tradable, v_ticker
    from public.stocks where id = p_stock_id for update;
  if not found then raise exception 'Stock not found'; end if;
  if not v_tradable then raise exception 'This stock is not tradable'; end if;

  select shares into v_held from public.stock_holdings
   where stock_id = p_stock_id and user_id = v_user_id for update;
  if coalesce(v_held, 0) < p_shares then
    raise exception 'You only hold % shares', coalesce(v_held, 0);
  end if;

  v_raw := greatest(0, public.stock_sell_proceeds(v_base, v_slope, v_out, p_shares));
  v_proceeds := round(v_raw);
  v_fee := round(v_raw * 100 / 10000);   -- 1% fee
  v_net := greatest(0, v_proceeds - v_fee);
  v_new_out := v_out - p_shares;

  update public.profiles set points_balance = points_balance + v_net where id = v_user_id;
  update public.stocks
     set shares_outstanding = v_new_out, treasury = treasury + v_fee
   where id = p_stock_id;
  update public.stock_holdings set shares = shares - p_shares
   where stock_id = p_stock_id and user_id = v_user_id;

  insert into public.stock_trades (stock_id, user_id, side, shares, cost, fee, spot_after)
  values (p_stock_id, v_user_id, 'sell', p_shares, v_net, v_fee, v_base + v_slope * v_new_out);

  insert into public.transactions (user_id, amount, reason)
  values (v_user_id, v_net, 'Sold ' || p_shares || ' shares of $' || v_ticker);

  return v_net;
end;
$$;

-- ── RPC: propose_event ───────────────────────────────────────

create or replace function public.propose_event(
  p_stock_id uuid, p_type text, p_label text,
  p_multiplier float8, p_dividend integer
)
returns uuid
language plpgsql security definer
as $$
declare
  v_user_id uuid := auth.uid();
  v_recent integer;
  v_event_id uuid;
begin
  if not exists (select 1 from public.stocks where id = p_stock_id) then
    raise exception 'Stock not found';
  end if;

  -- Rate limit: max 5 pending proposals per user per stock per day
  select count(*) into v_recent from public.stock_events
   where stock_id = p_stock_id and proposed_by = v_user_id
     and created_at > now() - interval '1 day';
  if v_recent >= 5 then raise exception 'Too many event proposals today'; end if;

  insert into public.stock_events (stock_id, proposed_by, type, label, multiplier, dividend_per_share)
  values (p_stock_id, v_user_id, p_type, p_label,
          coalesce(p_multiplier, 1), coalesce(p_dividend, 0))
  returning id into v_event_id;

  -- Proposer's own confirming vote
  insert into public.stock_event_confirmations (event_id, user_id, vote)
  values (v_event_id, v_user_id, 1);

  return v_event_id;
end;
$$;

-- ── Internal: apply an event (price shock + dividends) ───────

create or replace function public._apply_stock_event(p_event_id uuid)
returns void
language plpgsql security definer
as $$
declare
  v_stock_id uuid; v_mult float8; v_dps integer; v_status text; v_label text;
  v_ticker text; v_treasury integer; v_out integer;
  v_total_div bigint; v_factor float8; v_paid integer := 0;
  v_holder record; v_payout integer;
begin
  select e.stock_id, e.multiplier, e.dividend_per_share, e.status, e.label,
         s.ticker, s.treasury, s.shares_outstanding
    into v_stock_id, v_mult, v_dps, v_status, v_label, v_ticker, v_treasury, v_out
    from public.stock_events e join public.stocks s on s.id = e.stock_id
   where e.id = p_event_id for update;
  if v_status <> 'pending' then return; end if;

  -- Price shock
  if v_mult <> 1 then
    update public.stocks set base_price = base_price * v_mult where id = v_stock_id;
  end if;

  -- Dividend, funded from treasury (scaled down if treasury can't cover it)
  if v_dps > 0 and v_out > 0 and v_treasury > 0 then
    v_total_div := v_dps::bigint * v_out;
    v_factor := least(1, v_treasury::float8 / v_total_div);
    for v_holder in
      select user_id, shares from public.stock_holdings
       where stock_id = v_stock_id and shares > 0
    loop
      v_payout := floor(v_holder.shares * v_dps * v_factor);
      if v_payout > 0 then
        update public.profiles set points_balance = points_balance + v_payout
         where id = v_holder.user_id;
        insert into public.transactions (user_id, amount, reason)
        values (v_holder.user_id, v_payout, 'Dividend from $' || v_ticker || ': ' || v_label);
        v_paid := v_paid + v_payout;
      end if;
    end loop;
    update public.stocks set treasury = treasury - v_paid where id = v_stock_id;
  end if;

  update public.stock_events set status = 'applied', applied_at = now() where id = p_event_id;
end;
$$;

-- ── RPC: confirm_event ───────────────────────────────────────
-- Records a vote; applies the event once it has >= 2 confirmations
-- (counting the proposer) or when an admin confirms it.

create or replace function public.confirm_event(p_event_id uuid, p_vote integer)
returns text
language plpgsql security definer
as $$
declare
  v_user_id uuid := auth.uid();
  v_status text; v_confirms integer; v_is_admin boolean;
begin
  select status into v_status from public.stock_events where id = p_event_id for update;
  if not found then raise exception 'Event not found'; end if;
  if v_status <> 'pending' then return v_status; end if;

  insert into public.stock_event_confirmations (event_id, user_id, vote)
  values (p_event_id, v_user_id, case when p_vote < 0 then -1 else 1 end)
  on conflict (event_id, user_id) do update set vote = excluded.vote;

  select is_admin into v_is_admin from public.profiles where id = v_user_id;

  select count(*) into v_confirms from public.stock_event_confirmations
   where event_id = p_event_id and vote = 1;

  if v_is_admin or v_confirms >= 2 then
    perform public._apply_stock_event(p_event_id);
    return 'applied';
  end if;

  return 'pending';
end;
$$;

-- ── Auto-create a stock for every profile ────────────────────

create or replace function public.create_stock_for_profile()
returns trigger
language plpgsql security definer
as $$
declare
  v_base text; v_ticker text; v_n integer := 1;
begin
  v_base := upper(regexp_replace(coalesce(new.username, ''), '[^a-zA-Z0-9]', '', 'g'));
  v_base := left(v_base, 4);
  if v_base = '' then v_base := 'STK'; end if;
  v_ticker := v_base;
  while exists (select 1 from public.stocks where ticker = v_ticker) loop
    v_ticker := left(v_base, 3) || v_n::text;
    v_n := v_n + 1;
  end loop;

  insert into public.stocks (profile_id, ticker) values (new.id, v_ticker);
  return new;
end;
$$;

drop trigger if exists trg_create_stock on public.profiles;
create trigger trg_create_stock
  after insert on public.profiles
  for each row execute function public.create_stock_for_profile();

-- Backfill stocks for any existing profiles that don't have one yet.
do $$
declare r record; v_base text; v_ticker text; v_n integer;
begin
  for r in
    select p.id, p.username from public.profiles p
    left join public.stocks s on s.profile_id = p.id
    where s.id is null
  loop
    v_base := left(upper(regexp_replace(coalesce(r.username, ''), '[^a-zA-Z0-9]', '', 'g')), 4);
    if v_base = '' then v_base := 'STK'; end if;
    v_ticker := v_base; v_n := 1;
    while exists (select 1 from public.stocks where ticker = v_ticker) loop
      v_ticker := left(v_base, 3) || v_n::text; v_n := v_n + 1;
    end loop;
    insert into public.stocks (profile_id, ticker) values (r.id, v_ticker);
  end loop;
end $$;

-- ── Grants ───────────────────────────────────────────────────

grant execute on function public.stock_buy_cost(float8, float8, integer, integer) to authenticated;
grant execute on function public.stock_sell_proceeds(float8, float8, integer, integer) to authenticated;
grant execute on function public.buy_stock(uuid, integer) to authenticated;
grant execute on function public.sell_stock(uuid, integer) to authenticated;
grant execute on function public.propose_event(uuid, text, text, float8, integer) to authenticated;
grant execute on function public.confirm_event(uuid, integer) to authenticated;
