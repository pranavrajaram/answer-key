-- ============================================================
-- Enable Supabase Realtime for the stock market tables.
-- Run in the Supabase SQL Editor AFTER stocks.sql.
--
-- Adds the stock tables to the supabase_realtime publication so the
-- web client can subscribe to live INSERT/UPDATE events and refresh
-- prices without a manual reload. RLS still applies to realtime, and
-- these tables are already "Anyone can read", so broadcasts are safe.
-- ============================================================

do $$
begin
  -- stocks: base_price / shares_outstanding change on every trade & event
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'stocks'
  ) then
    alter publication supabase_realtime add table public.stocks;
  end if;

  -- stock_trades: new trades
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'stock_trades'
  ) then
    alter publication supabase_realtime add table public.stock_trades;
  end if;

  -- stock_events: proposed / applied life events
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'stock_events'
  ) then
    alter publication supabase_realtime add table public.stock_events;
  end if;
end $$;
