-- ============================================================
-- Seed Data — Run AFTER schema.sql
-- Creates 3 sample profiles and markets with bets.
-- NOTE: These profiles use fake UUIDs and are NOT linked to
-- real auth.users entries — they exist purely for demo display.
-- Real users are created on first login via /auth/callback.
-- ============================================================

-- ── Fake profiles (demo users) ───────────────────────────────

-- To use seed data with real auth, create users in the Supabase
-- Auth dashboard first, then replace these UUIDs with the real ones.

do $$
declare
  alice_id uuid := '00000000-0000-0000-0000-000000000001';
  bob_id   uuid := '00000000-0000-0000-0000-000000000002';
  carol_id uuid := '00000000-0000-0000-0000-000000000003';
  market1  uuid := gen_random_uuid();
  market2  uuid := gen_random_uuid();
  market3  uuid := gen_random_uuid();
begin

  -- Profiles (skip if already exist)
  insert into public.profiles (id, username, points_balance) values
    (alice_id, 'alice',  1340),
    (bob_id,   'bob',    820),
    (carol_id, 'carol',  1150)
  on conflict (id) do nothing;

  -- Market 1: open
  insert into public.markets (id, question, creator_id, options, q_values, b, closes_at)
  values (
    market1,
    'Will it rain in SF this weekend?',
    alice_id,
    array['Yes', 'No'],
    array[80.0, 60.0],
    100,
    now() + interval '3 days'
  ) on conflict (id) do nothing;

  insert into public.bets (market_id, user_id, option, amount) values
    (market1, alice_id, 'Yes', 30),
    (market1, bob_id,   'No',  20)
  on conflict do nothing;

  -- Market 2: open, multiple options
  insert into public.markets (id, question, creator_id, options, q_values, b, closes_at)
  values (
    market2,
    'Who wins the next group trivia night?',
    bob_id,
    array['Alice', 'Bob', 'Carol', 'Someone else'],
    array[90.0, 70.0, 65.0, 50.0],
    100,
    now() + interval '5 days'
  ) on conflict (id) do nothing;

  insert into public.bets (market_id, user_id, option, amount) values
    (market2, alice_id, 'Alice',       50),
    (market2, bob_id,   'Bob',         40),
    (market2, carol_id, 'Carol',       30),
    (market2, alice_id, 'Someone else', 10)
  on conflict do nothing;

  -- Market 3: resolved
  insert into public.markets (id, question, creator_id, options, q_values, b, closes_at, resolved_option)
  values (
    market3,
    'Will the Warriors make the playoffs?',
    carol_id,
    array['Yes', 'No'],
    array[110.0, 70.0],
    100,
    now() - interval '1 day',
    'Yes'
  ) on conflict (id) do nothing;

  insert into public.bets (market_id, user_id, option, amount) values
    (market3, alice_id, 'Yes', 60),
    (market3, bob_id,   'No',  40),
    (market3, carol_id, 'Yes', 80)
  on conflict do nothing;

  -- Transactions for resolved market
  insert into public.transactions (user_id, amount, reason, market_id) values
    (alice_id,  84, 'Won market: Will the Warriors make the playoffs?', market3),
    (carol_id, 112, 'Won market: Will the Warriors make the playoffs?', market3),
    (alice_id, -60, 'Bet on: Will the Warriors make the playoffs?', market3),
    (bob_id,   -40, 'Bet on: Will the Warriors make the playoffs?', market3),
    (carol_id, -80, 'Bet on: Will the Warriors make the playoffs?', market3)
  on conflict do nothing;

end $$;
