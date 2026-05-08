export interface Profile {
  id: string
  username: string
  points_balance: number
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
