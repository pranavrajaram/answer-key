-- ============================================================
-- Addons — run this in Supabase SQL Editor AFTER schema.sql
-- Adds: sells table, comments table, delete_market RPC,
--       sell_position RPC, lmsr_cost helper
-- ============================================================

-- ── New tables ───────────────────────────────────────────────

create table if not exists public.sells (
  id         uuid primary key default gen_random_uuid(),
  market_id  uuid references public.markets(id) on delete cascade,
  user_id    uuid references public.profiles(id) on delete cascade,
  option     text not null,
  shares     integer not null check (shares > 0),
  proceeds   integer not null,
  created_at timestamptz not null default now()
);

create table if not exists public.comments (
  id         uuid primary key default gen_random_uuid(),
  market_id  uuid not null references public.markets(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  content    text not null check (char_length(content) <= 500),
  created_at timestamptz not null default now()
);

-- ── RLS ─────────────────────────────────────────────────────

alter table public.sells    enable row level security;
alter table public.comments enable row level security;

create policy "Anyone can read sells"
  on public.sells for select using (true);

create policy "Anyone can read comments"
  on public.comments for select using (true);

create policy "Users can insert their own comments"
  on public.comments for insert with check (auth.uid() = user_id);

create policy "Users can delete their own comments"
  on public.comments for delete using (auth.uid() = user_id);

-- ── Helper: LMSR cost in SQL ─────────────────────────────────

create or replace function public.lmsr_cost(q float8[], b float8)
returns float8
language sql immutable as $$
  select b * ln(sum(exp(qi / b))) from unnest(q) qi
$$;

-- ── RPC: delete_market ───────────────────────────────────────
-- Refunds all bettors, then deletes market (cascades to bets/sells/comments)

create or replace function public.delete_market(p_market_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_caller_id  uuid := auth.uid();
  v_creator_id uuid;
  v_resolved   text;
  v_question   text;
  v_bet        record;
begin
  select creator_id, resolved_option, question
    into v_creator_id, v_resolved, v_question
    from public.markets
   where id = p_market_id
     for update;

  if not found then
    raise exception 'Market not found';
  end if;

  if v_creator_id <> v_caller_id then
    raise exception 'Only the creator can delete this market';
  end if;

  if v_resolved is not null then
    raise exception 'Cannot delete a resolved market';
  end if;

  -- Refund net amount to each bettor (bets minus any proceeds already received from sells)
  for v_bet in
    select
      b.user_id,
      coalesce(sum(b.amount), 0) - coalesce(
        (select sum(s.proceeds) from public.sells s
          where s.market_id = p_market_id and s.user_id = b.user_id), 0
      ) as refund
    from public.bets b
    where b.market_id = p_market_id
    group by b.user_id
  loop
    if v_bet.refund > 0 then
      update public.profiles
         set points_balance = points_balance + v_bet.refund
       where id = v_bet.user_id;

      insert into public.transactions (user_id, amount, reason, market_id)
      values (v_bet.user_id, v_bet.refund,
              'Refund: market deleted — ' || v_question, p_market_id);
    end if;
  end loop;

  delete from public.markets where id = p_market_id;
end;
$$;

-- ── RPC: sell_position ───────────────────────────────────────
-- Sells shares at current LMSR fair value, returns proceeds

create or replace function public.sell_position(
  p_market_id uuid,
  p_option    text,
  p_shares    integer
)
returns integer
language plpgsql
security definer
as $$
declare
  v_user_id    uuid := auth.uid();
  v_closes_at  timestamptz;
  v_resolved   text;
  v_question   text;
  v_options    text[];
  v_current_q  float8[];
  v_new_q      float8[];
  v_b          float8;
  v_option_idx integer;
  v_bought     integer;
  v_sold       integer;
  v_proceeds   integer;
begin
  select closes_at, resolved_option, question, options, q_values, b
    into v_closes_at, v_resolved, v_question, v_options, v_current_q, v_b
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

  v_option_idx := array_position(v_options, p_option);
  if v_option_idx is null then
    raise exception 'Invalid option';
  end if;

  -- Net position check
  select coalesce(sum(amount), 0) into v_bought
    from public.bets
   where market_id = p_market_id and user_id = v_user_id and option = p_option;

  select coalesce(sum(shares), 0) into v_sold
    from public.sells
   where market_id = p_market_id and user_id = v_user_id and option = p_option;

  if v_bought - v_sold < p_shares then
    raise exception 'You only hold % shares of %', v_bought - v_sold, p_option;
  end if;

  -- Compute new q_values
  v_new_q := v_current_q;
  v_new_q[v_option_idx] := v_new_q[v_option_idx] - p_shares;

  -- Proceeds = cost difference (always >= 0 in LMSR)
  v_proceeds := greatest(0, round(
    public.lmsr_cost(v_current_q, v_b) - public.lmsr_cost(v_new_q, v_b)
  ));

  -- Apply changes
  update public.markets set q_values = v_new_q where id = p_market_id;

  update public.profiles
     set points_balance = points_balance + v_proceeds
   where id = v_user_id;

  insert into public.sells (market_id, user_id, option, shares, proceeds)
  values (p_market_id, v_user_id, p_option, p_shares, v_proceeds);

  insert into public.transactions (user_id, amount, reason, market_id)
  values (v_user_id, v_proceeds,
          'Sold position: ' || p_option || ' — ' || v_question, p_market_id);

  return v_proceeds;
end;
$$;

grant execute on function public.delete_market(uuid) to authenticated;
grant execute on function public.sell_position(uuid, text, integer) to authenticated;
grant execute on function public.lmsr_cost(float8[], float8) to authenticated;
