-- Новая схема базы данных для COD BO6 Scoreboard
-- Версия 2: Глобальные игроки + сезонная статистика
-- Выполни этот SQL в Supabase SQL Editor

-- 1. Удаляем старые таблицы (если нужно начать заново)
-- DROP TABLE IF EXISTS match_players CASCADE;
-- DROP TABLE IF EXISTS matches CASCADE;
-- DROP TABLE IF EXISTS players CASCADE;
-- DROP TABLE IF EXISTS seasons CASCADE;

-- 2. Таблица сезонов
CREATE TABLE seasons (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  end_date TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Таблица глобальных игроков (не привязана к сезону)
CREATE TABLE players (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Таблица участия игроков в сезонах (связь многие-ко-многим + статистика)
CREATE TABLE season_players (
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
CREATE TABLE matches (
  id BIGSERIAL PRIMARY KEY,
  season_id BIGINT REFERENCES seasons(id) ON DELETE CASCADE,
  date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Таблица результатов матчей
CREATE TABLE match_players (
  id BIGSERIAL PRIMARY KEY,
  match_id BIGINT REFERENCES matches(id) ON DELETE CASCADE,
  player_id BIGINT REFERENCES players(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  points_earned DECIMAL(5,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(match_id, player_id)
);

-- Индексы для улучшения производительности
CREATE INDEX idx_season_players_season_id ON season_players(season_id);
CREATE INDEX idx_season_players_player_id ON season_players(player_id);
CREATE INDEX idx_matches_season_id ON matches(season_id);
CREATE INDEX idx_match_players_match_id ON match_players(match_id);
CREATE INDEX idx_match_players_player_id ON match_players(player_id);
CREATE INDEX idx_seasons_active ON seasons(is_active);

-- Функция для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Триггеры для автоматического обновления updated_at
CREATE TRIGGER update_seasons_updated_at 
  BEFORE UPDATE ON seasons 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_players_updated_at 
  BEFORE UPDATE ON players 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_season_players_updated_at 
  BEFORE UPDATE ON season_players 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

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
CREATE POLICY "Everyone can view seasons" ON seasons FOR SELECT USING (true);
CREATE POLICY "Everyone can insert seasons" ON seasons FOR INSERT WITH CHECK (true);
CREATE POLICY "Everyone can update seasons" ON seasons FOR UPDATE USING (true);
CREATE POLICY "Everyone can delete seasons" ON seasons FOR DELETE USING (true);

-- Players policies
CREATE POLICY "Everyone can view players" ON players FOR SELECT USING (true);
CREATE POLICY "Everyone can insert players" ON players FOR INSERT WITH CHECK (true);
CREATE POLICY "Everyone can update players" ON players FOR UPDATE USING (true);
CREATE POLICY "Everyone can delete players" ON players FOR DELETE USING (true);

-- Season players policies
CREATE POLICY "Everyone can view season_players" ON season_players FOR SELECT USING (true);
CREATE POLICY "Everyone can insert season_players" ON season_players FOR INSERT WITH CHECK (true);
CREATE POLICY "Everyone can update season_players" ON season_players FOR UPDATE USING (true);
CREATE POLICY "Everyone can delete season_players" ON season_players FOR DELETE USING (true);

-- Matches policies
CREATE POLICY "Everyone can view matches" ON matches FOR SELECT USING (true);
CREATE POLICY "Everyone can insert matches" ON matches FOR INSERT WITH CHECK (true);
CREATE POLICY "Everyone can update matches" ON matches FOR UPDATE USING (true);
CREATE POLICY "Everyone can delete matches" ON matches FOR DELETE USING (true);

-- Match players policies
CREATE POLICY "Everyone can view match_players" ON match_players FOR SELECT USING (true);
CREATE POLICY "Everyone can insert match_players" ON match_players FOR INSERT WITH CHECK (true);
CREATE POLICY "Everyone can update match_players" ON match_players FOR UPDATE USING (true);
CREATE POLICY "Everyone can delete match_players" ON match_players FOR DELETE USING (true);

-- Тестовые данные
INSERT INTO seasons (name, is_active) VALUES ('Сезон 1', true);

-- Добавляем тестовых игроков
INSERT INTO players (name) VALUES
    ('Player1'),
    ('Player2'),
    ('Player3'),
    ('Player4');

-- Связываем игроков с сезоном
DO $$
DECLARE
    season_id INTEGER;
    player_ids INTEGER[];
BEGIN
    SELECT id INTO season_id FROM seasons WHERE name = 'Сезон 1';
    SELECT ARRAY_AGG(id) INTO player_ids FROM players;
    
    -- Добавляем всех игроков в сезон с начальной статистикой
    INSERT INTO season_players (season_id, player_id, wins, points)
    SELECT season_id, unnest(player_ids), 0, 0;
END $$;
