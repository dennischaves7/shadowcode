-- Shadow Code — Schema real do banco de dados
-- Reflète a estrutura existente no PostgreSQL

CREATE TABLE IF NOT EXISTS games (
  id                SERIAL PRIMARY KEY,
  status            VARCHAR(20)  NOT NULL DEFAULT 'waiting', -- waiting | playing | finished
  turn_team         VARCHAR(10),
  phase             VARCHAR(10),                              -- clue | guess
  remaining_guesses INTEGER      DEFAULT 0,
  winner            VARCHAR(20),                             -- agents | impostor | NULL
  created_at        TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS players (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(50),
  game_id     INTEGER REFERENCES games(id),
  team        VARCHAR(10),
  is_master   BOOLEAN DEFAULT false,
  is_impostor BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS cards (
  id       SERIAL PRIMARY KEY,
  word     VARCHAR(50),
  game_id  INTEGER REFERENCES games(id),
  type     VARCHAR(20),    -- correct | neutral | assassin
  revealed BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS moves (
  id         SERIAL PRIMARY KEY,
  game_id    INTEGER REFERENCES games(id),
  player_id  INTEGER REFERENCES players(id),
  type       VARCHAR(20),  -- clue | vote | reveal
  content    TEXT,         -- JSON com dados específicos do tipo
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
