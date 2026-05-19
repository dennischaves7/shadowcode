const db = require('../config/db');

const WORDS = [
  'Dragão',    'Sombra',   'Ninja',    'Castelo',  'Robô',
  'Pirata',    'Laser',    'Fantasma', 'Cavaleiro','Tempestade',
  'Fênix',     'Serpente', 'Tigre',    'Lua',      'Estrela',
  'Alienígena','Magia',    'Rei',      'Rainha',   'Samurai',
  'Zumbi',     'Espião',   'Ciber',    'Lobo',     'Foguete',
  'Vírus',     'Cifra',    'Código',   'Invasão',  'Matriz',
  'Falcão',    'Trovão',   'Víbora',   'Espectro', 'Eclipse',
  'Nebulosa',  'Órbita',   'Pulso',    'Surto',    'Byte',
  'Vetor',     'Circuito', 'Depurar',  'Servidor', 'Falha',
  'Portal',    'Nexo',     'Renegado', 'Furtivo',  'Chama',
  'Adaga',     'Escudo',   'Cofre',    'Gelo',     'Brasa',
  'Delta',     'Sigma',    'Alpha',    'Ômega',    'Ápice',
  'Corvo',     'Cobra',    'Pantera',  'Hidra',    'Assombro',
  'Espectral', 'Lâmina',   'Brasa',    'Faísca',   'Fluxo',
  'Miragem',   'Quasar',   'Fenda',    'Fragmento','Toxina',
  'Veneno',    'Zênite',   'Abismo',   'Bastião',  'Relâmpago',
  'Agente',    'Missão',   'Arquivo',  'Segredo',  'Alvo',
  'Desvio',    'Infiltrar','Resgatar', 'Operação', 'Codinome',
];

// SQLite armazena booleanos como 0/1 — converte para JS
function toGame(row) {
  if (!row) return null;
  return row;
}

function toPlayer(row) {
  if (!row) return null;
  return {
    ...row,
    is_master:   !!row.is_master,
    is_impostor: !!row.is_impostor,
    role: row.is_master ? 'master' : 'agent',
  };
}

function toCard(row) {
  if (!row) return null;
  return { ...row, revealed: !!row.revealed };
}

function parseClueMove(row) {
  if (!row) return null;
  const { word, number, round } = JSON.parse(row.content);
  return { id: row.id, game_id: row.game_id, word, number, round, created_at: row.created_at };
}

// ── Partida ───────────────────────────────────────────────────────

async function createGame() {
  const { lastInsertRowid } = db.prepare(
    `INSERT INTO games(status) VALUES('waiting')`
  ).run();
  return toGame(db.prepare(`SELECT * FROM games WHERE id = ?`).get(lastInsertRowid));
}

async function getGame(gameId) {
  return toGame(db.prepare(`SELECT * FROM games WHERE id = ?`).get(gameId));
}

async function updateGameStatus(gameId, status, phase = null, winner = null) {
  db.prepare(`
    UPDATE games
       SET status = ?,
           phase  = COALESCE(?, phase),
           winner = COALESCE(?, winner)
     WHERE id = ?
  `).run(status, phase, winner, gameId);
  return toGame(db.prepare(`SELECT * FROM games WHERE id = ?`).get(gameId));
}

// ── Jogadores ─────────────────────────────────────────────────────

async function getMasterByGame(gameId) {
  return toPlayer(db.prepare(
    `SELECT * FROM players WHERE game_id = ? AND is_master = 1 LIMIT 1`
  ).get(gameId));
}

async function getPlayersByGame(gameId) {
  return db.prepare(
    `SELECT * FROM players WHERE game_id = ? ORDER BY id ASC`
  ).all(gameId).map(toPlayer);
}

async function addPlayer(name, gameId, gameRole) {
  const isMaster = gameRole === 'master' ? 1 : 0;
  const { lastInsertRowid } = db.prepare(
    `INSERT INTO players(name, game_id, is_master, team) VALUES(?, ?, ?, 'main')`
  ).run(name, gameId, isMaster);
  return toPlayer(db.prepare(`SELECT * FROM players WHERE id = ?`).get(lastInsertRowid));
}

async function setImpostor(playerId) {
  db.prepare(`UPDATE players SET is_impostor = 1 WHERE id = ?`).run(playerId);
}

// ── Cartas ────────────────────────────────────────────────────────

async function getCardsByGame(gameId) {
  return db.prepare(
    `SELECT * FROM cards WHERE game_id = ? ORDER BY id ASC`
  ).all(gameId).map(toCard);
}

async function hasCards(gameId) {
  return !!db.prepare(`SELECT 1 FROM cards WHERE game_id = ? LIMIT 1`).get(gameId);
}

async function insertCards(cardsArray) {
  const stmt = db.prepare(`INSERT INTO cards(word, game_id, type) VALUES(?, ?, ?)`);
  const insertMany = db.transaction((cards) => {
    for (const c of cards) stmt.run(c.word, c.gameId, c.type);
  });
  insertMany(cardsArray);
}

async function getCard(cardId) {
  return toCard(db.prepare(`SELECT * FROM cards WHERE id = ?`).get(cardId));
}

async function revealCard(cardId) {
  db.prepare(`UPDATE cards SET revealed = 1 WHERE id = ?`).run(cardId);
}

async function getRemainingCorrect(gameId) {
  return db.prepare(
    `SELECT * FROM cards WHERE game_id = ? AND type = 'correct' AND revealed = 0`
  ).all(gameId).map(toCard);
}

// ── Dicas (tabela moves, type = 'clue') ──────────────────────────

async function addClue(gameId, playerId, word, number, round) {
  const content = JSON.stringify({ word, number, round });
  const { lastInsertRowid } = db.prepare(
    `INSERT INTO moves(game_id, player_id, type, content) VALUES(?, ?, 'clue', ?)`
  ).run(gameId, playerId, content);
  return parseClueMove(db.prepare(`SELECT * FROM moves WHERE id = ?`).get(lastInsertRowid));
}

async function getCluesByGame(gameId) {
  return db.prepare(
    `SELECT * FROM moves WHERE game_id = ? AND type = 'clue' ORDER BY id ASC`
  ).all(gameId).map(parseClueMove);
}

async function countClues(gameId) {
  const row = db.prepare(
    `SELECT COUNT(*) AS total FROM moves WHERE game_id = ? AND type = 'clue'`
  ).get(gameId);
  return row.total;
}

module.exports = {
  WORDS,
  // game
  createGame,
  getGame,
  updateGameStatus,
  // players
  getMasterByGame,
  getPlayersByGame,
  addPlayer,
  setImpostor,
  // cards
  getCardsByGame,
  hasCards,
  insertCards,
  getCard,
  revealCard,
  getRemainingCorrect,
  // clues (via moves)
  addClue,
  getCluesByGame,
  countClues,
};
