const { Router } = require('express');
const {
  handleCreateGame,
  handleJoinGame,
  handleStartGame,
  handleGetState,
  handleGetMyRole,
  handleGetCards,
  handleRevealCard,
  handleSubmitClue,
  handleGetClues,
} = require('../controllers/gameController');

module.exports = (io, roundState) => {
  const router = Router();

  // leitura
  router.get('/state',   (req, res) => handleGetState(req, res));
  router.get('/my-role', (req, res) => handleGetMyRole(req, res));
  router.get('/cards',   (req, res) => handleGetCards(req, res));
  router.get('/clues',   (req, res) => handleGetClues(req, res));

  // escrita
  router.post('/create', (req, res) => handleCreateGame(req, res));
  router.post('/join',   (req, res) => handleJoinGame(req, res, io));
  router.post('/start',  (req, res) => handleStartGame(req, res, io));
  router.post('/reveal', (req, res) => handleRevealCard(req, res, io));
  router.post('/clue',   (req, res) => handleSubmitClue(req, res, io, roundState));

  return router;
};
