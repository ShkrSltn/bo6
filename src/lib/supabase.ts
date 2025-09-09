import { createClient } from "@supabase/supabase-js";

// Get configuration from environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase environment variables. Please check your .env file."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Типы для новой архитектуры базы данных
export interface DatabaseSeason {
  id: number;
  name: string;
  start_date: string;
  end_date?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DatabasePlayer {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface DatabaseSeasonPlayer {
  id: number;
  season_id: number;
  player_id: number;
  wins: number;
  points: number;
  created_at: string;
  updated_at: string;
}

export interface DatabaseMatch {
  id: number;
  season_id: number;
  date: string;
  created_at: string;
  updated_at: string;
}

export interface DatabaseMatchPlayer {
  id: number;
  match_id: number;
  player_id: number;
  position: number;
  points_earned: number;
  created_at: string;
}

// Типы для frontend
export interface Season {
  id: number;
  name: string;
  startDate: string;
  endDate?: string;
  isActive: boolean;
  players: Player[];
  matches: Match[];
}

export interface Player {
  id: number;
  playerId: number; // ID глобального игрока
  name: string;
  wins: number;
  points: number;
}

export interface Match {
  id: number;
  seasonId: number;
  date: string;
  players: MatchPlayer[];
}

export interface MatchPlayer {
  playerId: number;
  position: number;
  pointsEarned: number;
}
