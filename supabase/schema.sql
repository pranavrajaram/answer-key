-- ============================================================
-- Prediction Market — Full Schema
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- ── Tables ──────────────────────────────────────────────────

create table if not exists public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  username        text not null,
  points_balance  integer not null default 1000,
  created_at      timestamptz not null default now()
);

create table if not exists public.markets (
  id              uuid primary key default gen_random_uuid(),
  question        text not null,
  creator_id      uuid not null references public.profiles(id) on delete cascade,
  options         text[] not null,
  q_values        float8[] not null,
  b               float8 not null default 100,
  closes_at       timestamptz not null,
  resolved_option text,
  created_at      timestamptz not null default now()
);

create table if not exists public.bets (
  id         uuid primary key default gen_random_uuid(),
  market_id  uuid not null references public.markets(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  option     text not null,
  amount     integer not null check (amount > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.transactions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  amount     integer not null,
  reason     text not null,
  market_id  uuid references public.markets(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ── Row Level Security ───────────────────────────────────────

alter table public.profiles    enable row level security;
alter table public.markets     enable row level security;
alter table public.bets        enable row level security;
alter table public.transactions enable row level security;

-- profiles
create policy "Anyone can read profiles"
  on public.profiles for select using (true);

create policy "Users can insert their own profile"
  on public.profiles for insert with check (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update using (auth.uid() = id);

-- markets
create policy "Anyone can read markets"
  on public.markets for select using (true);

create policy "Authenticated users can create markets"
  on public.markets for insert with check (auth.uid() = creator_id);

create policy "Creator can update their market"
  on public.markets for update using (auth.uid() = creator_id);

-- bets
create policy "Anyone can read bets"
  on public.bets for select using (true);

create policy "Authenticated users can insert their own bets"
  on public.bets for insert with check (auth.uid() = user_id);

-- transactions
create policy "Users can read their own transactions"
  on public.transactions for select using (auth.uid() = user_id);

create policy "Service role can insert transactions"
  on public.transactions for insert with check (true);

-- ── RPC: place_bet ──────────────────────────────────────────
-- Atomically: insert bet, update q_values, deduct points, log transaction

create or replace function public.place_bet(
  p_market_id   uuid,
  p_option      text,
  p_amount      integer,
  p_new_q_values float8[]
)
returns void
language plpgsql
security definer
as $$
declare
  v_user_id    uuid := auth.uid();
  v_balance    integer;
  v_closes_at  timestamptz;
  v_resolved   text;
  v_question   text;
begin
  -- Validate market state
  select closes_at, resolved_option, question
    into v_closes_at, v_resolved, v_question
    from public.markets
   where id = p_market_id
     for update;

  if not found then
    raise exception 'Market not found';
  end if;

  if v_closes_at <= now() then
    raise exception 'Market is closed';
  end if;

  if v_resolved is not null then
    raise exception 'Market is already resolved';
  end if;

  -- Check user balance
  select points_balance into v_balance
    from public.profiles
   where id = v_user_id
     for update;

  if v_balance < p_amount then
    raise exception 'Insufficient points';
  end if;

  -- Insert bet
  insert into public.bets (market_id, user_id, option, amount)
  values (p_market_id, v_user_id, p_option, p_amount);

  -- Update market q_values
  update public.markets
     set q_values = p_new_q_values
   where id = p_market_id;

  -- Deduct points
  update public.profiles
     set points_balance = points_balance - p_amount
   where id = v_user_id;

  -- Log transaction
  insert into public.transactions (user_id, amount, reason, market_id)
  values (v_user_id, -p_amount, 'Bet on: ' || v_question, p_market_id);
end;
$$;

-- ── RPC: resolve_market ─────────────────────────────────────
-- Atomically: set resolved_option, pay out winners, log transactions

create or replace function public.resolve_market(
  p_market_id      uuid,
  p_winning_option text
)
returns void
language plpgsql
security definer
as $$
declare
  v_caller_id  uuid := auth.uid();
  v_resolved   text;
  v_question   text;
  v_total_pot  integer;
  v_winners_pot integer;
  v_bet        record;
  v_payout     integer;
begin
  -- Any authenticated user may resolve an unresolved market.
  if v_caller_id is null then
    raise exception 'Authentication required';
  end if;

  select resolved_option, question
    into v_resolved, v_question
    from public.markets
   where id = p_market_id
     for update;

  if not found then
    raise exception 'Market not found';
  end if;

  if v_resolved is not null then
    raise exception 'Market already resolved';
  end if;

  -- Validate winning option is one of the market's options
  if not exists (
    select 1 from public.markets
     where id = p_market_id
       and p_winning_option = any(options)
  ) then
    raise exception 'Invalid winning option';
  end if;

  -- Compute pots
  select coalesce(sum(amount), 0) into v_total_pot
    from public.bets
   where market_id = p_market_id;

  select coalesce(sum(amount), 0) into v_winners_pot
    from public.bets
   where market_id = p_market_id
     and option = p_winning_option;

  -- Mark market resolved
  update public.markets
     set resolved_option = p_winning_option
   where id = p_market_id;

  -- Pay out winners (proportional)
  if v_winners_pot > 0 then
    for v_bet in
      select * from public.bets
       where market_id = p_market_id
         and option = p_winning_option
    loop
      v_payout := round((v_bet.amount::float / v_winners_pot) * v_total_pot);

      update public.profiles
         set points_balance = points_balance + v_payout
       where id = v_bet.user_id;

      insert into public.transactions (user_id, amount, reason, market_id)
      values (v_bet.user_id, v_payout, 'Won market: ' || v_question, p_market_id);
    end loop;
  end if;
end;
$$;

-- Grant execute to authenticated users
revoke execute on function public.resolve_market(uuid, text) from public;
revoke execute on function public.resolve_market(uuid, text) from anon;
grant execute on function public.place_bet(uuid, text, integer, float8[]) to authenticated;
grant execute on function public.resolve_market(uuid, text) to authenticated;
