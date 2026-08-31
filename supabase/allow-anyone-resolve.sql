-- ============================================================
-- Upgrade: allow any authenticated user to resolve a market
-- Run once in the Supabase SQL Editor for an existing project.
-- Fresh projects get this function from schema.sql instead.
-- ============================================================

create or replace function public.resolve_market(
  p_market_id      uuid,
  p_winning_option text
)
returns void
language plpgsql
security definer
as $$
declare
  v_caller_id   uuid := auth.uid();
  v_resolved    text;
  v_question    text;
  v_total_pot   integer;
  v_winners_pot integer;
  v_bet         record;
  v_payout      integer;
begin
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

  if not exists (
    select 1 from public.markets
     where id = p_market_id
       and p_winning_option = any(options)
  ) then
    raise exception 'Invalid winning option';
  end if;

  select coalesce(sum(amount), 0) into v_total_pot
    from public.bets
   where market_id = p_market_id;

  select coalesce(sum(amount), 0) into v_winners_pot
    from public.bets
   where market_id = p_market_id
     and option = p_winning_option;

  update public.markets
     set resolved_option = p_winning_option
   where id = p_market_id;

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

revoke execute on function public.resolve_market(uuid, text) from public;
revoke execute on function public.resolve_market(uuid, text) from anon;
grant execute on function public.resolve_market(uuid, text) to authenticated;
