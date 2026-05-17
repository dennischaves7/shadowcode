const {
  WORDS,
  createGame,
  getGame,
  updateGameStatus,
  getMasterByGame,
  getPlayersByGame,
  addPlayer,
  setImpostor,
  getCardsByGame,
  hasCards,
  insertCards,
  getCard,
  revealCard,
  getRemainingCorrect,
  addClue,
  getCluesByGame,
  countClues,
} = require('../models/gameModel');

// ── Criar partida ─────────────────────────────────────────────────
async function handleCreateGame(_req, res) {
  try {
    const game = await createGame();
    res.status(201).json(game);
  } catch (err) {
    console.error('[createGame]', err);
    res.status(500).json({ error: 'Erro ao criar partida' });
  }
}

// ── Entrar na partida ─────────────────────────────────────────────
async function handleJoinGame(req, res, io) {
  try {
    const { game_id, name, role } = req.body;

    if (!game_id || !name) {
      return res.status(400).json({ error: 'game_id e name são obrigatórios' });
    }

    const game = await getGame(game_id);
    if (!game) return res.status(404).json({ error: 'Partida não encontrada' });
    if (game.status !== 'waiting') {
      return res.status(400).json({ error: 'Partida já iniciada' });
    }

    if (role === 'master') {
      const existing = await getMasterByGame(game_id);
      if (existing) {
        return res.status(400).json({ error: 'Já existe um mestre nesta partida' });
      }
    }

    const player = await addPlayer(name, game_id, role || 'agent');

    io.to(`game_${game_id}`).emit('player_joined', player);

    res.status(201).json(player);
  } catch (err) {
    console.error('[joinGame]', err);
    res.status(500).json({ error: 'Erro ao entrar na partida' });
  }
}

// ── Iniciar partida ───────────────────────────────────────────────
async function handleStartGame(req, res, io) {
  try {
    const { game_id } = req.body;

    if (!game_id) {
      return res.status(400).json({ error: 'game_id é obrigatório' });
    }

    const game = await getGame(game_id);
    if (!game) return res.status(404).json({ error: 'Partida não encontrada' });
    if (game.status !== 'waiting') {
      return res.status(400).json({ error: 'Partida já foi iniciada' });
    }

    const alreadyHasCards = await hasCards(game_id);
    if (alreadyHasCards) {
      return res.status(400).json({ error: 'Cartas já foram geradas' });
    }

    const players = await getPlayersByGame(game_id);
    // if (players.length < 3) {
    //   return res.status(400).json({ error: 'São necessários pelo menos 3 jogadores' });
    // }

    const master = players.find(p => p.role === 'master');
    if (!master) {
      return res.status(400).json({ error: 'Nenhum mestre encontrado' });
    }

    const agents = players.filter(p => p.role === 'agent');
    if (agents.length < 2) {
      return res.status(400).json({ error: 'São necessários pelo menos 2 agentes' });
    }

    const impostor = agents[Math.floor(Math.random() * agents.length)];
    await setImpostor(impostor.id);
    await updateGameStatus(game_id, 'playing', 'clue');

    const shuffledWords = [...WORDS].sort(() => Math.random() - 0.5).slice(0, 25);
    const types = [
      ...Array(15).fill('correct'),
      ...Array(9).fill('neutral'),
      ...Array(1).fill('assassin'),
    ].sort(() => Math.random() - 0.5);

    const cards = shuffledWords.map((word, i) => ({
      word,
      gameId: game_id,
      type: types[i],
    }));

    await insertCards(cards);

    io.to(`game_${game_id}`).emit('game_started', { master: master.name });

    res.json({
      success: true,
      master: master.name,
      impostorId: impostor.id,
    });
  } catch (err) {
    console.error('[startGame]', err);
    res.status(500).json({ error: 'Erro ao iniciar partida' });
  }
}

// ── Buscar estado completo ─────────────────────────────────────────
async function handleGetState(req, res) {
  try {
    const { game_id } = req.query;
    if (!game_id) return res.status(400).json({ error: 'game_id é obrigatório' });

    const [game, players, cards, clues] = await Promise.all([
      getGame(game_id),
      getPlayersByGame(game_id),
      getCardsByGame(game_id),
      getCluesByGame(game_id),
    ]);

    if (!game) return res.status(404).json({ error: 'Partida não encontrada' });

    res.json({ game, players, cards, clues });
  } catch (err) {
    console.error('[getState]', err);
    res.status(500).json({ error: 'Erro ao buscar estado da partida' });
  }
}

// ── Buscar cartas ─────────────────────────────────────────────────
async function handleGetCards(req, res) {
  try {
    const { game_id } = req.query;
    if (!game_id) return res.status(400).json({ error: 'game_id é obrigatório' });

    const cards = await getCardsByGame(game_id);
    res.json(cards);
  } catch (err) {
    console.error('[getCards]', err);
    res.status(500).json({ error: 'Erro ao buscar cartas' });
  }
}

// ── Revelar carta ─────────────────────────────────────────────────
async function handleRevealCard(req, res, io) {
  try {
    const { card_id } = req.body;
    if (!card_id) return res.status(400).json({ error: 'card_id é obrigatório' });

    const card = await getCard(card_id);
    if (!card) return res.status(404).json({ error: 'Carta não encontrada' });
    if (card.revealed) return res.status(400).json({ error: 'Carta já revelada' });

    await revealCard(card_id);

    io.to(`game_${card.game_id}`).emit('card_revealed', {
      cardId: card.id,
      type:   card.type,
      word:   card.word,
    });

    if (card.type === 'assassin') {
      await updateGameStatus(card.game_id, 'finished', null, 'impostor');
      io.to(`game_${card.game_id}`).emit('game_finished', { winner: 'impostor' });
      return res.json({ result: 'assassin', winner: 'impostor' });
    }

    const remaining = await getRemainingCorrect(card.game_id);
    if (remaining.length === 0) {
      await updateGameStatus(card.game_id, 'finished', null, 'agents');
      io.to(`game_${card.game_id}`).emit('game_finished', { winner: 'agents' });
      return res.json({ result: 'correct', winner: 'agents' });
    }

    res.json({ result: card.type });
  } catch (err) {
    console.error('[revealCard]', err);
    res.status(500).json({ error: 'Erro ao revelar carta' });
  }
}

// ── Enviar dica (mestre) ──────────────────────────────────────────
async function handleSubmitClue(req, res, io, roundState) {
  try {
    const { game_id, word, number } = req.body;

    if (!game_id || !word || !number) {
      return res.status(400).json({ error: 'game_id, word e number são obrigatórios' });
    }
    if (number < 1 || number > 9) {
      return res.status(400).json({ error: 'number deve ser entre 1 e 9' });
    }

    const game = await getGame(game_id);
    if (!game) return res.status(404).json({ error: 'Partida não encontrada' });
    if (game.status !== 'playing') {
      return res.status(400).json({ error: 'Partida não está em andamento' });
    }

    const master = await getMasterByGame(game_id);
    if (!master) return res.status(400).json({ error: 'Mestre não encontrado' });

    const round = (await countClues(game_id)) + 1;
    const clue  = await addClue(game_id, master.id, word.trim(), number, round);

    await updateGameStatus(game_id, 'playing', 'guess');

    // Atualiza estado em memória para controle de rodada
    if (roundState) {
      if (!roundState[game_id]) roundState[game_id] = {};
      roundState[game_id].phase    = 'guess';
      roundState[game_id].flips    = 0;
      roundState[game_id].maxFlips = Number(number) + 1; // agentes podem virar +1 além do número
    }

    io.to(`game_${game_id}`).emit('clue_submitted', clue);

    res.status(201).json(clue);
  } catch (err) {
    console.error('[submitClue]', err);
    res.status(500).json({ error: 'Erro ao enviar dica' });
  }
}

// ── Buscar dicas ──────────────────────────────────────────────────
async function handleGetClues(req, res) {
  try {
    const { game_id } = req.query;
    if (!game_id) return res.status(400).json({ error: 'game_id é obrigatório' });

    const clues = await getCluesByGame(game_id);
    res.json(clues);
  } catch (err) {
    console.error('[getClues]', err);
    res.status(500).json({ error: 'Erro ao buscar dicas' });
  }
}

module.exports = {
  handleCreateGame,
  handleJoinGame,
  handleStartGame,
  handleGetState,
  handleGetCards,
  handleRevealCard,
  handleSubmitClue,
  handleGetClues,
};
