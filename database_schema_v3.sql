-- Обновленная схема базы данных для COD BO6 Scoreboard
-- Версия 3: Добавлены победы в матче (wins_in_match)
-- Выполни этот SQL в Supabase SQL Editor

-- Если нужно добавить новое поле к существующей таблице match_players
ALTER TABLE match_players 
ADD COLUMN IF NOT EXISTS wins_in_match INTEGER DEFAULT 0;

-- Полная схема для нового развертывания:

-- 1. Удаляем старые таблицы (если нужно начать заново)
-- DROP TABLE IF EXISTS match_players CASCADE;
-- DROP TABLE IF EXISTS matches CASCADE;
-- DROP TABLE IF EXISTS season_players CASCADE;
-- DROP TABLE IF EXISTS players CASCADE;
-- DROP TABLE IF EXISTS seasons CASCADE;

-- 2. Таблица сезонов
CREATE TABLE IF NOT EXISTS seasons (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  end_date TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Таблица глобальных игроков (не привязана к сезону)
CREATE TABLE IF NOT EXISTS players (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Таблица участия игроков в сезонах (связь многие-ко-многим + статистика)
CREATE TABLE IF NOT EXISTS season_players (
  id BIGSERIAL PRIMARY KEY,
  season_id BIGINT REFERENCES seasons(id) ON DELETE CASCADE,
  player_id BIGINT REFERENCES players(id) ON DELETE CASCADE,
  wins INTEGER DEFAULT 0,
  points DECIMAL(5,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(season_id, player_id)
);

-- 5. Таблица матчей
CREATE TABLE IF NOT EXISTS matches (
  id BIGSERIAL PRIMARY KEY,
  season_id BIGINT REFERENCES seasons(id) ON DELETE CASCADE,
  date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Таблица результатов матчей (обновленная с полем wins_in_match)
CREATE TABLE IF NOT EXISTS match_players (
  id BIGSERIAL PRIMARY KEY,
  match_id BIGINT REFERENCES matches(id) ON DELETE CASCADE,
  player_id BIGINT REFERENCES players(id) ON DELETE CASCADE,
  wins_in_match INTEGER NOT NULL DEFAULT 0, -- Количество побед игрока в этом матче
  position INTEGER NOT NULL, -- Место, рассчитанное автоматически на основе wins_in_match
  points_earned DECIMAL(5,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(match_id, player_id)
);

-- Индексы для улучшения производительности
CREATE INDEX IF NOT EXISTS idx_season_players_season_id ON season_players(season_id);
CREATE INDEX IF NOT EXISTS idx_season_players_player_id ON season_players(player_id);
CREATE INDEX IF NOT EXISTS idx_matches_season_id ON matches(season_id);
CREATE INDEX IF NOT EXISTS idx_match_players_match_id ON match_players(match_id);
CREATE INDEX IF NOT EXISTS idx_match_players_player_id ON match_players(player_id);
CREATE INDEX IF NOT EXISTS idx_seasons_active ON seasons(is_active);

-- Функция для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Триггеры для автоматического обновления updated_at
DROP TRIGGER IF EXISTS update_seasons_updated_at ON seasons;
CREATE TRIGGER update_seasons_updated_at 
  BEFORE UPDATE ON seasons 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_players_updated_at ON players;
CREATE TRIGGER update_players_updated_at 
  BEFORE UPDATE ON players 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_season_players_updated_at ON season_players;
CREATE TRIGGER update_season_players_updated_at 
  BEFORE UPDATE ON season_players 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_matches_updated_at ON matches;
CREATE TRIGGER update_matches_updated_at 
  BEFORE UPDATE ON matches 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Включение Row Level Security
ALTER TABLE seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE season_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_players ENABLE ROW LEVEL SECURITY;

-- Политики безопасности: все могут читать и изменять данные

-- Seasons policies
DROP POLICY IF EXISTS "Everyone can view seasons" ON seasons;
DROP POLICY IF EXISTS "Everyone can insert seasons" ON seasons;
DROP POLICY IF EXISTS "Everyone can update seasons" ON seasons;
DROP POLICY IF EXISTS "Everyone can delete seasons" ON seasons;

CREATE POLICY "Everyone can view seasons" ON seasons FOR SELECT USING (true);
CREATE POLICY "Everyone can insert seasons" ON seasons FOR INSERT WITH CHECK (true);
CREATE POLICY "Everyone can update seasons" ON seasons FOR UPDATE USING (true);
CREATE POLICY "Everyone can delete seasons" ON seasons FOR DELETE USING (true);

-- Players policies
DROP POLICY IF EXISTS "Everyone can view players" ON players;
DROP POLICY IF EXISTS "Everyone can insert players" ON players;
DROP POLICY IF EXISTS "Everyone can update players" ON players;
DROP POLICY IF EXISTS "Everyone can delete players" ON players;

CREATE POLICY "Everyone can view players" ON players FOR SELECT USING (true);
CREATE POLICY "Everyone can insert players" ON players FOR INSERT WITH CHECK (true);
CREATE POLICY "Everyone can update players" ON players FOR UPDATE USING (true);
CREATE POLICY "Everyone can delete players" ON players FOR DELETE USING (true);

-- Season players policies
DROP POLICY IF EXISTS "Everyone can view season_players" ON season_players;
DROP POLICY IF EXISTS "Everyone can insert season_players" ON season_players;
DROP POLICY IF EXISTS "Everyone can update season_players" ON season_players;
DROP POLICY IF EXISTS "Everyone can delete season_players" ON season_players;

CREATE POLICY "Everyone can view season_players" ON season_players FOR SELECT USING (true);
CREATE POLICY "Everyone can insert season_players" ON season_players FOR INSERT WITH CHECK (true);
CREATE POLICY "Everyone can update season_players" ON season_players FOR UPDATE USING (true);
CREATE POLICY "Everyone can delete season_players" ON season_players FOR DELETE USING (true);

-- Matches policies
DROP POLICY IF EXISTS "Everyone can view matches" ON matches;
DROP POLICY IF EXISTS "Everyone can insert matches" ON matches;
DROP POLICY IF EXISTS "Everyone can update matches" ON matches;
DROP POLICY IF EXISTS "Everyone can delete matches" ON matches;

CREATE POLICY "Everyone can view matches" ON matches FOR SELECT USING (true);
CREATE POLICY "Everyone can insert matches" ON matches FOR INSERT WITH CHECK (true);
CREATE POLICY "Everyone can update matches" ON matches FOR UPDATE USING (true);
CREATE POLICY "Everyone can delete matches" ON matches FOR DELETE USING (true);

-- Match players policies
DROP POLICY IF EXISTS "Everyone can view match_players" ON match_players;
DROP POLICY IF EXISTS "Everyone can insert match_players" ON match_players;
DROP POLICY IF EXISTS "Everyone can update match_players" ON match_players;
DROP POLICY IF EXISTS "Everyone can delete match_players" ON match_players;

CREATE POLICY "Everyone can view match_players" ON match_players FOR SELECT USING (true);
CREATE POLICY "Everyone can insert match_players" ON match_players FOR INSERT WITH CHECK (true);
CREATE POLICY "Everyone can update match_players" ON match_players FOR UPDATE USING (true);
CREATE POLICY "Everyone can delete match_players" ON match_players FOR DELETE USING (true);
