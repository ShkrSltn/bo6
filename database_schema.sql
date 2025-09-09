-- Создание таблиц для COD BO6 Scoreboard
-- Выполни этот SQL в Supabase SQL Editor

-- 1. Таблица сезонов
CREATE TABLE seasons (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  end_date TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Таблица игроков (связана с сезонами)
CREATE TABLE players (
  id BIGSERIAL PRIMARY KEY,
  season_id BIGINT REFERENCES seasons(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  wins INTEGER DEFAULT 0,
  points DECIMAL(5,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Таблица матчей
CREATE TABLE matches (
  id BIGSERIAL PRIMARY KEY,
  season_id BIGINT REFERENCES seasons(id) ON DELETE CASCADE,
  date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Таблица результатов матчей (связь между матчами и игроками)
CREATE TABLE match_players (
  id BIGSERIAL PRIMARY KEY,
  match_id BIGINT REFERENCES matches(id) ON DELETE CASCADE,
  player_id BIGINT REFERENCES players(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  points_earned DECIMAL(5,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Индексы для улучшения производительности
CREATE INDEX idx_players_season_id ON players(season_id);
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

CREATE TRIGGER update_matches_updated_at 
  BEFORE UPDATE ON matches 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Включение Row Level Security
ALTER TABLE seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_players ENABLE ROW LEVEL SECURITY;

-- Политики безопасности: все могут читать и изменять данные
-- (в production можно ограничить по пользователям)

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

-- Получаем ID созданного сезона для тестовых данных
DO $$
DECLARE
    season_id INTEGER;
BEGIN
    SELECT id INTO season_id FROM seasons WHERE name = 'Сезон 1';
    
    -- Добавляем тестовых игроков
    INSERT INTO players (season_id, name, wins, points) VALUES
        (season_id, 'Player1', 2, 5.5),
        (season_id, 'Player2', 1, 3.0),
        (season_id, 'Player3', 0, 1.0),
        (season_id, 'Player4', 0, 0.0);
END $$;
