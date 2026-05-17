const Database = require('better-sqlite3');
const path     = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', '..', 'shadowcode.db');
const db = new Database(DB_PATH);

// Melhor performance em escrita concorrente
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Cria as tabelas automaticamente se não existirem
db.exec(`
  CREATE TABLE IF NOT EXISTS games (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    status            TEXT    NOT NULL DEFAULT 'waiting',
    turn_team         TEXT,
    phase             TEXT,
    remaining_guesses INTEGER DEFAULT 0,
    winner            TEXT,
    created_at        DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS players (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT,
    game_id     INTEGER REFERENCES games(id),
    team        TEXT,
    is_master   INTEGER DEFAULT 0,
    is_impostor INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS cards (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    word     TEXT,
    game_id  INTEGER REFERENCES games(id),
    type     TEXT,
    revealed INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS moves (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id    INTEGER REFERENCES games(id),
    player_id  INTEGER REFERENCES players(id),
    type       TEXT,
    content    TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

console.log(`Banco SQLite pronto em: ${DB_PATH}`);

module.exports = db;
