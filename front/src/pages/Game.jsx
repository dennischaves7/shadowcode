import "./Game.css";
import cartaBege    from "../assets/cartas/cartaBege.png";
import cartaDourada from "../assets/cartas/cartaDourada.png";
import cartaPreta   from "../assets/cartas/cartaPreta.png";
import { FaCommentDots, FaPaperPlane, FaPlus, FaBars, FaChevronLeft } from "react-icons/fa";
import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { io } from "socket.io-client";

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const CARD_IMG = {
  neutral:  cartaBege,
  correct:  cartaDourada,
  assassin: cartaPreta,
};

export default function Game() {
  const navigate    = useNavigate();
  const [searchParams] = useSearchParams();
  const gameId      = searchParams.get('gameId');
  const socketRef   = useRef(null);

  const isMaster = localStorage.getItem('gameRole') === 'master';
  const myNick   = localStorage.getItem('nick') || '';

  const [cards,     setCards]     = useState([]);
  const [players,   setPlayers]   = useState([]);
  const [clues,     setClues]     = useState([]);
  const [activeClue,  setActiveClue]  = useState(null);
  const [clueWord,    setClueWord]    = useState('');
  const [clueNumber,  setClueNumber]  = useState(1);
  const [loading,     setLoading]     = useState(true);
  const [gameOver,    setGameOver]    = useState(null);
  const [showPlayersPanel, setShowPlayersPanel] = useState(false);
  const [isImpostor,  setIsImpostor]  = useState(false);
  const [phase,       setPhase]       = useState('clue'); // 'clue' | 'guess'

  useEffect(() => {
    if (!gameId) {
      navigate('/');
      return;
    }

    fetch(`${API_URL}/game/state?game_id=${gameId}`)
      .then(r => r.json())
      .then(({ cards: c, players: p, clues: cl, game }) => {
        setCards(c.map(card => ({ ...card, votes: 0 })));

        const stored = JSON.parse(localStorage.getItem(`avatars_${gameId}`) || '[]');
        const avatarMap = Object.fromEntries(stored.map(a => [a.nick, a.avatar]));
        setPlayers(p.map(player => ({ ...player, avatar: avatarMap[player.name] || '' })));

        const me = p.find(player => player.name === myNick);
        if (me?.is_impostor) setIsImpostor(true);

        setClues(cl);
        if (cl.length > 0) {
          setActiveClue(cl[cl.length - 1]);
          setPhase(game.phase === 'guess' ? 'guess' : 'clue');
        }
        if (game.status === 'finished') setGameOver({ winner: game.winner });
        setLoading(false);
      })
      .catch(() => setLoading(false));

    const socket = io(API_URL);
    socketRef.current = socket;

    socket.on('connect', () => socket.emit('join_room', gameId));

    socket.on('votes_update', ({ cardId, votes }) => {
      setCards(prev => prev.map(c => c.id === cardId ? { ...c, votes } : c));
    });

    socket.on('card_revealed', ({ cardId, type }) => {
      setCards(prev => prev.map(c =>
        c.id === cardId ? { ...c, revealed: true, type, votes: 0 } : c
      ));
    });

    socket.on('clue_submitted', (clue) => {
      setClues(prev => [...prev, clue]);
      setActiveClue(clue);
      setPhase('guess');
    });

    socket.on('round_end', () => {
      setPhase('clue');
      setActiveClue(null);
      setCards(prev => prev.map(c => ({ ...c, votes: 0 })));
    });

    socket.on('game_finished', ({ winner }) => setGameOver({ winner }));

    return () => socket.disconnect();
  }, [gameId]);

  const handleVote = (card) => {
    if (card.revealed || !socketRef.current) return;
    if (card.votes >= 3) {
      // Qualquer jogador pode virar carta com 3 votos
      socketRef.current.emit('flip_card', { gameId, cardId: card.id });
    } else if (!isMaster && phase === 'guess') {
      // Agentes/impostor só votam após a dica do mestre
      socketRef.current.emit('vote_card', { gameId, cardId: card.id });
    }
  };

  const handleSendClue = async () => {
    const word = clueWord.trim();
    if (!word || word.includes(' ')) return;
    const clue = { word, number: clueNumber };
    try {
      await fetch(`${API_URL}/game/clue`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ game_id: gameId, word, number: clueNumber }),
      });
      setActiveClue(clue);
      setClueWord('');
      setClueNumber(1);
    } catch (err) {
      console.error('[sendClue]', err);
    }
  };

  const master    = players.find(p => p.role === 'master');
  const agents    = players.filter(p => p.role === 'agent');
  const remaining = cards.filter(c => c.type === 'correct' && !c.revealed).length;

  if (loading) {
    return (
      <div className="game-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        Carregando...
      </div>
    );
  }

  if (gameOver) {
    return (
      <div className="game-page" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1.5rem' }}>
        <h1 className="game-title">
          {gameOver.winner === 'agents'
            ? <><span className="hl-yellow">AGENTES</span> VENCEM!</>
            : <>IMPOSTOR <span className="hl-yellow">VENCE!</span></>}
        </h1>
        <button className="clue-send" style={{ padding: '0.8rem 2rem', fontSize: '1rem' }} onClick={() => navigate('/')}>
          Voltar ao início
        </button>
      </div>
    );
  }

  return (
    <div className="game-page">

      {/* NAVBAR MOBILE */}
      <div className="game-mobile-nav">
        <button className="game-nav-btn" onClick={() => navigate(-1)}>
          <FaChevronLeft />
        </button>
        <div className="game-nav-title">
          {isMaster
            ? <>DÊ UMA <span className="hl-yellow">DICA</span> PARA SEUS <span className="hl-yellow">AGENTES</span></>
            : isImpostor
            ? <>VOCÊ É O <span className="hl-yellow">IMPOSTOR</span>, ATRAPALHE OS <span className="hl-yellow">AGENTES</span></>
            : <>VOCÊ É UM <span className="hl-yellow">AGENTE</span>, ESPERE A DICA DO <span className="hl-yellow">MESTRE</span></>}
        </div>
        <button className="game-nav-btn" onClick={() => setShowPlayersPanel(p => !p)}>
          <FaBars />
        </button>
      </div>

      {/* DRAWER DE PLAYERS (mobile) */}
      {showPlayersPanel && (
        <>
          <div className="drawer-backdrop" onClick={() => setShowPlayersPanel(false)} />
          <div className="players-drawer">
            <button className="drawer-close" onClick={() => setShowPlayersPanel(false)}>✕</button>
            <div className="drawer-section">
              <span className="panel-label">MESTRE</span>
              <div className="drawer-master-row">
                {master && (
                  <>
                    <div className="master-ring drawer-avatar">
                      <img src={master.avatar} alt={master.name} />
                    </div>
                    <p className="drawer-master-name">{master.name}</p>
                  </>
                )}
              </div>
            </div>
            <div className="drawer-section">
              <span className="panel-label">AGENTES</span>
              <div className="drawer-agents-row">
                {agents.map(agent => (
                  <div className="drawer-agent" key={agent.id}>
                    <div className="agent-ring drawer-avatar-sm">
                      <img src={agent.avatar} alt={agent.name} />
                    </div>
                    <span className="drawer-agent-name">{agent.name}</span>
                  </div>
                ))}
              </div>
            </div>
            <button className="drawer-exit-btn" onClick={() => navigate('/')}>SAIR</button>
          </div>
        </>
      )}

      {/* TÍTULO */}
      <h1 className="game-title">
        {isMaster
          ? <>DÊ UMA <span className="hl-yellow">DICA</span> PARA SEUS <span className="hl-yellow">AGENTES</span></>
          : isImpostor
          ? <>VOCÊ É O <span className="hl-yellow">IMPOSTOR</span>, ATRAPALHE OS <span className="hl-yellow">AGENTES</span></>
          : <>VOCÊ É UM <span className="hl-yellow">AGENTE</span>, ESPERE A DICA DO <span className="hl-yellow">MESTRE</span></>}
      </h1>

      <div className="game-body">

        {/* PAINEL MESTRE */}
        <aside className="panel-master">
          <span className="panel-label">MESTRE</span>
          {master && (
            <>
              <div className="master-ring">
                <img src={master.avatar} alt={master.name} />
              </div>
              <p className="master-name">{master.name}</p>
            </>
          )}
        </aside>

        {/* GRID + BARRA */}
        <div className="game-center">

          <div className="card-grid">
            {cards.map(card => (
              <div
                key={card.id}
                className={`game-card${card.revealed ? ' revealed' : ''}${!card.revealed && card.votes >= 3 ? ' ready' : ''}`}
                onClick={() => handleVote(card)}
              >
                <img src={isMaster || card.revealed ? CARD_IMG[card.type] : cartaBege} alt={card.word} className="card-img" />
                {!card.revealed && (
                  <div className="card-votes">
                    {[0, 1, 2].map(i => (
                      <span key={i} className={`vote-dash${card.votes > i ? ' filled' : ''}`} />
                    ))}
                  </div>
                )}
                <span className="card-word">{card.word}</span>
              </div>
            ))}
          </div>

          {/* LOG MOBILE */}
          <div className="mobile-log">
            <span className="panel-label">REGISTRO DAS RODADAS</span>
            <div className="mobile-log-rows">
              {Array.from({ length: 5 }, (_, i) => {
                const clue = clues[i];
                return (
                  <div className="log-row" key={i}>
                    <span className="log-num">{i + 1}</span>
                    <span className={`log-dot${clue ? ' used' : ''}`} />
                    {clue && <span className="log-clue">{clue.word} <b>{clue.number}</b></span>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* BARRA DE DICA — só mestre digita; agentes apenas veem */}
          {isMaster && (
            activeClue ? (
              <div className="clue-display">
                <span className="clue-display-word">{activeClue.word}</span>
                <span className="clue-display-number">{activeClue.number}</span>
                <button className="clue-new-btn" onClick={() => setActiveClue(null)} title="Nova dica">
                  <FaPlus />
                </button>
              </div>
            ) : (
              <div className="clue-bar">
                <FaCommentDots className="clue-dots" />
                <input
                  className="clue-input"
                  type="text"
                  placeholder="Sua dica (uma palavra)..."
                  value={clueWord}
                  onChange={e => setClueWord(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSendClue()}
                  autoFocus
                />
                <div className="clue-number">
                  <button className="clue-minus" onClick={() => setClueNumber(n => Math.max(1, n - 1))}>−</button>
                  <span className="clue-num-display">{clueNumber}</span>
                  <button className="clue-minus" onClick={() => setClueNumber(n => Math.min(9, n + 1))}>+</button>
                </div>
                <button className="clue-send" onClick={handleSendClue}>
                  <FaPaperPlane />
                </button>
              </div>
            )
          )}

          {!isMaster && activeClue && (
            <div className="clue-display">
              <span className="clue-display-word">{activeClue.word}</span>
              <span className="clue-display-number">{activeClue.number}</span>
            </div>
          )}
        </div>

        {/* SIDEBAR */}
        <aside className="panel-sidebar">
          <div className="sidebar-agents">
            <span className="panel-label">AGENTES</span>
            {agents.map(agent => (
              <div className="sidebar-agent" key={agent.id}>
                <div className="agent-ring">
                  <img src={agent.avatar} alt={agent.name} />
                </div>
                <span className="agent-name">{agent.name}</span>
              </div>
            ))}
          </div>

          <div className="sidebar-log">
            <span className="panel-label">REGISTRO DAS RODADAS</span>
            {Array.from({ length: 5 }, (_, i) => {
              const clue = clues[i];
              return (
                <div className="log-row" key={i}>
                  <span className="log-num">{i + 1}</span>
                  <span className={`log-dot${clue ? ' used' : ''}`} />
                  {clue && <span className="log-clue">{clue.word} <b>{clue.number}</b></span>}
                </div>
              );
            })}
          </div>

          <div className="remaining-count">
            <span className="remaining-label">Restam</span>
            <span className="remaining-num">{remaining}</span>
          </div>
        </aside>

      </div>
    </div>
  );
}
