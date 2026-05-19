const express = require('express');
const cors    = require('cors');
const http    = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const db         = require('./config/db');
const gameRoutes = require('./routes/gameRoutes');
const {
  WORDS,
  createGame,
  getGame,
  addPlayer,
  getPlayersByGame,
  setImpostor,
  updateGameStatus,
  insertCards,
  getCard,
  revealCard,
  getRemainingCorrect,
} = require('./models/gameModel');

const app    = express();
const server = http.createServer(app);

const ALLOWED_ORIGIN = (process.env.ALLOWED_ORIGIN || 'http://localhost:5173').replace(/\/$/, '');

app.use(cors({ origin: ALLOWED_ORIGIN }));
app.use(express.json());

const io = new Server(server, {
  cors: { origin: ALLOWED_ORIGIN },
});

// ── Estado em memória ──────────────────────────────────────────────
const lobbies    = {};
const gameVotes  = {}; // { [gameId]: { [cardId]: Set<socketId> } }
const roundState = {}; // { [gameId]: { phase, flips, maxFlips, lobbyCode, roundTime } }
const roundTimers = {}; // { [gameId]: timeoutHandle }

// ── Rotas ──────────────────────────────────────────────────────────
app.use('/game', gameRoutes(io, roundState, startRoundTimer));

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s.slice(0, 3) + '-' + s.slice(3);
}

// ── Timer de rodada ────────────────────────────────────────────────
function clearRoundTimer(gameId) {
  if (roundTimers[gameId]) {
    clearTimeout(roundTimers[gameId]);
    delete roundTimers[gameId];
  }
}

async function startRoundTimer(gameId) {
  clearRoundTimer(gameId);
  const rs = roundState[gameId];
  if (!rs?.roundTime) return;

  io.to(`game_${gameId}`).emit('round_timer', { duration: rs.roundTime });

  roundTimers[gameId] = setTimeout(async () => {
    delete roundTimers[gameId];
    const rs2 = roundState[gameId];
    if (!rs2 || rs2.phase !== 'guess') return;
    try {
      await updateGameStatus(gameId, 'playing', 'clue');
      if (gameVotes[gameId]) gameVotes[gameId] = {};
      rs2.phase = 'clue';
      rs2.flips = 0;
      io.to(`game_${gameId}`).emit('round_end', { reason: 'timeout' });
    } catch (err) {
      console.error('[round_timer expire]', err);
    }
  }, rs.roundTime * 1000);
}

// ── Lógica de virar carta (compartilhada) ──────────────────────────
async function flipCard(gameId, cardId) {
  const card = await getCard(cardId);
  if (!card || card.revealed) return;

  await revealCard(cardId);
  if (gameVotes[gameId]) delete gameVotes[gameId][cardId];

  io.to(`game_${gameId}`).emit('card_revealed', {
    cardId: card.id,
    type:   card.type,
    word:   card.word,
  });

  if (card.type === 'assassin') {
    clearRoundTimer(gameId);
    await updateGameStatus(gameId, 'finished', null, 'impostor');
    const lobbyCode = roundState[gameId]?.lobbyCode;
    io.to(`game_${gameId}`).emit('game_finished', { winner: 'impostor', lobbyCode });

  } else if (card.type === 'neutral') {
    clearRoundTimer(gameId);
    await updateGameStatus(gameId, 'playing', 'clue');
    if (gameVotes[gameId]) gameVotes[gameId] = {};
    if (roundState[gameId]) { roundState[gameId].phase = 'clue'; roundState[gameId].flips = 0; }
    io.to(`game_${gameId}`).emit('round_end', { reason: 'neutral' });

  } else if (card.type === 'correct') {
    const remaining = await getRemainingCorrect(gameId);
    if (remaining.length === 0) {
      clearRoundTimer(gameId);
      await updateGameStatus(gameId, 'finished', null, 'agents');
      const lobbyCode = roundState[gameId]?.lobbyCode;
      io.to(`game_${gameId}`).emit('game_finished', { winner: 'agents', lobbyCode });
      return;
    }
    if (roundState[gameId]) {
      roundState[gameId].flips++;
      if (roundState[gameId].flips >= roundState[gameId].maxFlips) {
        clearRoundTimer(gameId);
        await updateGameStatus(gameId, 'playing', 'clue');
        if (gameVotes[gameId]) gameVotes[gameId] = {};
        roundState[gameId].phase = 'clue';
        roundState[gameId].flips = 0;
        io.to(`game_${gameId}`).emit('round_end', { reason: 'limit' });
      }
    }
  }
}

// ── Socket.io ──────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log('Socket conectado:', socket.id);

  // join de sala de jogo (game em andamento)
  socket.on('join_room', (gameId) => {
    socket.join(`game_${gameId}`);
  });

  // ── Admin cria lobby ───────────────────────────────────────────
  socket.on('lobby_create', ({ nick, avatar }) => {
    let code;
    do { code = generateCode(); } while (lobbies[code]);

    lobbies[code] = { code, adminSocketId: socket.id, players: [] };
    socket.join(`lobby_${code}`);
    socket.data = { lobbyCode: code, nick, avatar, isAdmin: true };

    socket.emit('lobby_created', { code });
    socket.emit('lobby_update', []);
  });

  // ── Player entra via código ────────────────────────────────────
  socket.on('lobby_join_code', ({ code, nick, avatar }) => {
    const lobby = lobbies[code];
    if (!lobby) {
      socket.emit('lobby_error', { message: 'Sala não encontrada' });
      return;
    }
    socket.join(`lobby_${code}`);
    socket.data = { lobbyCode: code, nick, avatar, isAdmin: false };

    socket.emit('lobby_joined', { code });
    socket.emit('lobby_update', lobby.players);
    socket.emit('lobby_timer_update', { seconds: lobby.roundTime || null });
  });

  // ── Escolher papel (mestre / agente) ───────────────────────────
  socket.on('lobby_choose_role', ({ code, gameRole }) => {
    const lobby = lobbies[code];
    if (!lobby) return;

    const alreadyIn = lobby.players.some(p => p.socketId === socket.id);
    if (!alreadyIn) {
      const agentCount = lobby.players.filter(p => p.gameRole === 'agent').length;
      if (gameRole === 'agent' && agentCount >= 10) {
        socket.emit('lobby_error', { message: 'Limite de 10 agentes atingido.' });
        return;
      }
    }

    lobby.players = lobby.players.filter(p => p.socketId !== socket.id);

    if (gameRole === 'master') {
      lobby.players = lobby.players.map(p =>
        p.gameRole === 'master' ? { ...p, gameRole: 'agent' } : p
      );
    }

    lobby.players.push({
      socketId: socket.id,
      nick:     socket.data.nick,
      avatar:   socket.data.avatar,
      gameRole,
      isAdmin:  socket.data.isAdmin || false,
    });

    io.to(`lobby_${code}`).emit('lobby_update', lobby.players);
  });

  // ── Admin: expulsar player ─────────────────────────────────────
  socket.on('lobby_kick', ({ code, targetSocketId }) => {
    const lobby = lobbies[code];
    if (!lobby || lobby.adminSocketId !== socket.id) return;

    lobby.players = lobby.players.filter(p => p.socketId !== targetSocketId);
    io.to(targetSocketId).emit('lobby_kicked');
    io.to(`lobby_${code}`).emit('lobby_update', lobby.players);
  });

  // ── Admin: randomizar papéis ───────────────────────────────────
  socket.on('lobby_randomize', ({ code }) => {
    const lobby = lobbies[code];
    if (!lobby || lobby.adminSocketId !== socket.id || lobby.players.length === 0) return;

    const shuffled = [...lobby.players].sort(() => Math.random() - 0.5);
    lobby.players = shuffled.map((p, i) => ({ ...p, gameRole: i === 0 ? 'master' : 'agent' }));
    io.to(`lobby_${code}`).emit('lobby_update', lobby.players);
  });

  // ── Admin: mover papel ─────────────────────────────────────────
  socket.on('lobby_move_role', ({ code, targetSocketId, newRole }) => {
    const lobby = lobbies[code];
    if (!lobby || lobby.adminSocketId !== socket.id) return;

    if (newRole === 'master') {
      lobby.players = lobby.players.map(p =>
        p.gameRole === 'master' ? { ...p, gameRole: 'agent' } : p
      );
    }
    lobby.players = lobby.players.map(p =>
      p.socketId === targetSocketId ? { ...p, gameRole: newRole } : p
    );
    io.to(`lobby_${code}`).emit('lobby_update', lobby.players);
  });

  // ── Admin: definir tempo por rodada ───────────────────────────
  socket.on('lobby_set_timer', ({ code, seconds }) => {
    const lobby = lobbies[code];
    if (!lobby || lobby.adminSocketId !== socket.id) return;
    lobby.roundTime = seconds || null;
    io.to(`lobby_${code}`).emit('lobby_timer_update', { seconds: lobby.roundTime });
  });

  // ── Player: sair da equipe ────────────────────────────────────
  socket.on('lobby_leave', ({ code }) => {
    const lobby = lobbies[code];
    if (!lobby) return;
    lobby.players = lobby.players.filter(p => p.socketId !== socket.id);
    io.to(`lobby_${code}`).emit('lobby_update', lobby.players);
  });

  // ── Admin: redefinir papéis ────────────────────────────────────
  socket.on('lobby_reset', ({ code }) => {
    const lobby = lobbies[code];
    if (!lobby || lobby.adminSocketId !== socket.id) return;

    lobby.players = [];
    io.to(`lobby_${code}`).emit('lobby_update', []);
  });

  // ── Admin: iniciar partida ─────────────────────────────────────
  socket.on('lobby_start', async ({ code }) => {
    const lobby = lobbies[code];
    if (!lobby || lobby.adminSocketId !== socket.id) return;

    const hasMaster = lobby.players.some(p => p.gameRole === 'master');

    if (!hasMaster) {
      socket.emit('game_start_error', { message: 'É necessário um mestre para iniciar.' });
      return;
    }

    try {
      const game   = await createGame();
      const gameId = game.id;

      for (const p of lobby.players) {
        await addPlayer(p.nick, gameId, p.gameRole);
      }

      const dbPlayers     = await getPlayersByGame(gameId);
      const dbAgents      = dbPlayers.filter(p => p.role === 'agent');
      const impostorCount = dbAgents.length >= 6 ? 2 : 1;
      const shuffled      = [...dbAgents].sort(() => Math.random() - 0.5);
      const impostors     = shuffled.slice(0, impostorCount);
      for (const imp of impostors) await setImpostor(imp.id);
      const impostorNicks = new Set(impostors.map(i => i.name));
      await updateGameStatus(gameId, 'playing', 'clue');

      const shuffledWords = [...WORDS].sort(() => Math.random() - 0.5).slice(0, 25);
      const types = [
        ...Array(10).fill('correct'),
        ...Array(12).fill('neutral'),
        ...Array(3).fill('assassin'),
      ].sort(() => Math.random() - 0.5);
      const cards = shuffledWords.map((word, i) => ({ word, gameId, type: types[i] }));
      await insertCards(cards);

      roundState[gameId] = { phase: 'clue', flips: 0, maxFlips: 0, lobbyCode: code, roundTime: lobby.roundTime || null };

      const avatars = lobby.players.map(p => ({ nick: p.nick, avatar: p.avatar }));

      // Notifica cada jogador com seu papel (impostor ou agente) no mesmo evento
      for (const p of lobby.players) {
        io.to(p.socketId).emit('game_ready', {
          gameId,
          avatars,
          isImpostor: impostorNicks.has(p.nick),
        });
      }
      // Notifica o admin caso ele não esteja na lista de jogadores
      const adminInPlayers = lobby.players.some(p => p.socketId === lobby.adminSocketId);
      if (!adminInPlayers) {
        io.to(lobby.adminSocketId).emit('game_ready', { gameId, avatars });
      }
    } catch (err) {
      console.error('[lobby_start]', err);
      socket.emit('game_start_error', { message: 'Erro ao iniciar. Banco de dados está conectado?' });
    }
  });

  // ── Admin retorna à sala após partida ─────────────────────────
  socket.on('lobby_reclaim_admin', ({ code, nick, avatar }) => {
    const lobby = lobbies[code];
    if (!lobby) {
      socket.emit('lobby_error', { message: 'Sala não encontrada' });
      return;
    }
    const prevAdmin = io.sockets.sockets.get(lobby.adminSocketId);
    if (prevAdmin) {
      socket.emit('lobby_error', { message: 'Admin já está na sala' });
      return;
    }
    lobby.adminSocketId = socket.id;
    lobby.players = lobby.players.filter(p => p.socketId !== socket.id);
    socket.join(`lobby_${code}`);
    socket.data = { lobbyCode: code, nick, avatar, isAdmin: true };
    socket.emit('lobby_update', lobby.players);
  });

  // ── Votar em carta ─────────────────────────────────────────────
  socket.on('vote_card', async ({ gameId, cardId }) => {
    const rs = roundState[gameId];
    const phase = rs ? rs.phase : (await getGame(gameId))?.phase;
    if (phase !== 'guess') return;

    if (!gameVotes[gameId]) gameVotes[gameId] = {};
    if (!gameVotes[gameId][cardId]) gameVotes[gameId][cardId] = new Set();

    gameVotes[gameId][cardId].add(socket.id);
    const voteCount = gameVotes[gameId][cardId].size;

    io.to(`game_${gameId}`).emit('votes_update', { cardId, votes: voteCount });

    if (voteCount >= 3) {
      try { await flipCard(gameId, cardId); } catch (err) { console.error('[vote_card auto-flip]', err); }
    }
  });

  // ── Virar carta (fallback para cartas que já têm 3 votos) ───────
  socket.on('flip_card', async ({ gameId, cardId }) => {
    const rs = roundState[gameId];
    const phase = rs ? rs.phase : (await getGame(gameId))?.phase;
    if (phase !== 'guess') return;

    const voteCount = gameVotes[gameId]?.[cardId]?.size ?? 0;
    if (voteCount < 3) return;

    try { await flipCard(gameId, cardId); } catch (err) { console.error('[flip_card]', err); }
  });

  // ── Admin: retornar todos ao lobby após partida ────────────────
  socket.on('lobby_return', ({ gameId, lobbyCode }) => {
    io.to(`game_${gameId}`).emit('return_to_lobby', { lobbyCode });
  });

  // ── Desconexão ─────────────────────────────────────────────────
  socket.on('disconnect', () => {
    const code = socket.data?.lobbyCode;
    if (code && lobbies[code]) {
      lobbies[code].players = lobbies[code].players.filter(p => p.socketId !== socket.id);
      if (lobbies[code].adminSocketId === socket.id && lobbies[code].players.length === 0) {
        delete lobbies[code];
      } else if (lobbies[code]) {
        io.to(`lobby_${code}`).emit('lobby_update', lobbies[code].players);
      }
    }
    console.log('Socket desconectado:', socket.id);
  });
});

// ── Health check ───────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  try {
    db.prepare('SELECT 1').get();
    res.json({ status: 'ok' });
  } catch {
    res.status(500).json({ status: 'db_error' });
  }
});

// ── Start ──────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
