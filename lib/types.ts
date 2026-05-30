export interface Profile {
  id: string
  username: string
  points_balance: number
  is_admin?: boolean
  created_at?: string
}

export interface Market {
  id: string
  question: string
  creator_id: string
  options: string[]
  q_values: number[]
  b: number
  closes_at: string
  resolved_option: string | null
  created_at: string
  profiles?: Profile
}

export interface Bet {
  id: string
  market_id: string
  user_id: string
  option: string
  amount: number
  created_at: string
  profiles?: Profile
}

export interface Transaction {
  id: string
  user_id: string
  amount: number
  reason: string
  market_id: string | null
  created_at: string
}

export interface Stock {
  id: string
  profile_id: string
  ticker: string
  base_price: number
  slope: number
  shares_outstanding: number
  treasury: number
  tradable: boolean
  created_at: string
  profiles?: Profile
}

export interface StockTrade {
  id: string
  stock_id: string
  user_id: string
  side: 'buy' | 'sell'
  shares: number
  cost: number
  fee: number
  spot_after: number
  created_at: string
  profiles?: Profile
}

export interface StockHolding {
  stock_id: string
  user_id: string
  shares: number
  stocks?: Stock
  profiles?: Profile
}

export type StockEventStatus = 'pending' | 'applied' | 'rejected'

export interface StockEvent {
  id: string
  stock_id: string
  proposed_by: string
  type: string
  label: string
  multiplier: number
  dividend_per_share: number
  status: StockEventStatus
  applied_at: string | null
  created_at: string
  profiles?: Profile
  stocks?: Stock
}

export interface StockEventConfirmation {
  event_id: string
  user_id: string
  vote: number
}
