import "./Game.css";
import cartaBege    from "../assets/cartas/cartaBege.png";
import cartaDourada from "../assets/cartas/cartaDourada.png";
import cartaPreta   from "../assets/cartas/cartaPreta.png";
import { FaCommentDots, FaPaperPlane, FaPlus, FaBars, FaChevronLeft, FaVolumeUp, FaVolumeMute } from "react-icons/fa";
const myNick   = localStorage.getItem('nick')           || 'Jogador';
const myAvatar = localStorage.getItem('selectedAvatar') || '';
import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { io } from "socket.io-client";
import { useLanguage } from "../contexts/LanguageContext";
import { useMusic } from "../contexts/MusicContext";

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
  const { t } = useLanguage();
  const { musicOn, toggleMusic } = useMusic();
  const socketRef   = useRef(null);

  const isMaster = localStorage.getItem('gameRole') === 'master';
  const isAdmin  = localStorage.getItem('userRole') === 'admin';

  const [cards,     setCards]     = useState([]);
  const [players,   setPlayers]   = useState([]);
  const [clues,     setClues]     = useState([]);
  const [activeClue,  setActiveClue]  = useState(null);
  const [clueWord,    setClueWord]    = useState('');
  const [clueNumber,  setClueNumber]  = useState(1);
  const [loading,     setLoading]     = useState(true);
  const [gameOver,    setGameOver]    = useState(null);
  const [showResult,  setShowResult]  = useState(false);
  const [showPlayersPanel, setShowPlayersPanel] = useState(false);
  const [isImpostor,  setIsImpostor]  = useState(() => localStorage.getItem(`isImpostor_${searchParams.get('gameId')}`) === 'true');
  const [phase,       setPhase]       = useState('clue'); // 'clue' | 'guess'
  const [votedCards,    setVotedCards]    = useState(new Set()); // cartas que este jogador já votou
  const [roundTimeLeft, setRoundTimeLeft] = useState(null);
  const [roundTimeDuration, setRoundTimeDuration] = useState(null);
  const countdownRef = useRef(null);
  const pageRef      = useRef(null);

  // Congela o layout da página: salva a altura real da tela antes do teclado abrir
  // e a reaplica sempre que o viewport visual mudar (teclado abrindo/fechando).
  useEffect(() => {
    const html          = document.documentElement;
    const body          = document.body;
    const initialHeight = window.innerHeight;
    const initialWidth  = window.innerWidth;

    // Aplica dimensões fixas no elemento raiz da página
    const applyFixedSize = () => {
      const el = pageRef.current;
      if (!el) return;
      el.style.height    = `${initialHeight}px`;
      el.style.maxHeight = `${initialHeight}px`;
      el.style.width     = `${initialWidth}px`;
      el.style.maxWidth  = `${initialWidth}px`;
    };

    const prev = {
      htmlOverflow:   html.style.overflow,
      htmlHeight:     html.style.height,
      bodyOverflow:   body.style.overflow,
      bodyPosition:   body.style.position,
      bodyWidth:      body.style.width,
      bodyHeight:     body.style.height,
      bodyTop:        body.style.top,
      bodyLeft:       body.style.left,
      bodyOverscroll: body.style.overscrollBehavior,
    };

    html.style.overflow           = 'hidden';
    html.style.height             = '100%';
    body.style.overflow           = 'hidden';
    body.style.position           = 'fixed';
    body.style.width              = '100%';
    body.style.height             = '100%';
    body.style.top                = '0';
    body.style.left               = '0';
    body.style.overscrollBehavior = 'none';

    applyFixedSize();

    // VisualViewport.resize: evento exato que dispara quando o teclado abre/fecha
    // (Chrome 61+, Safari 13+). Reimpõe a altura original para ignorar o resize.
    window.visualViewport?.addEventListener('resize', applyFixedSize);
    // Fallback para browsers que não suportam VisualViewport
    window.addEventListener('resize', applyFixedSize);

    return () => {
      html.style.overflow           = prev.htmlOverflow;
      html.style.height             = prev.htmlHeight;
      body.style.overflow           = prev.bodyOverflow;
      body.style.position           = prev.bodyPosition;
      body.style.width              = prev.bodyWidth;
      body.style.height             = prev.bodyHeight;
      body.style.top                = prev.bodyTop;
      body.style.left               = prev.bodyLeft;
      body.style.overscrollBehavior = prev.bodyOverscroll;
      window.visualViewport?.removeEventListener('resize', applyFixedSize);
      window.removeEventListener('resize', applyFixedSize);
    };
  }, []);

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

        setClues(cl);
        if (cl.length > 0) {
          setActiveClue(cl[cl.length - 1]);
          setPhase(game.phase === 'guess' ? 'guess' : 'clue');
        }
        if (game.status === 'finished') { setGameOver({ winner: game.winner, lobbyCode: localStorage.getItem('lastLobbyCode') }); setShowResult(true); }
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

    socket.on('round_timer', ({ duration }) => {
      if (countdownRef.current) clearInterval(countdownRef.current);
      setRoundTimeDuration(duration);
      setRoundTimeLeft(duration);
      countdownRef.current = setInterval(() => {
        setRoundTimeLeft(prev => {
          if (prev === null || prev <= 1) {
            clearInterval(countdownRef.current);
            countdownRef.current = null;
            return null;
          }
          return prev - 1;
        });
      }, 1000);
    });

    socket.on('round_end', () => {
      setPhase('clue');
      setActiveClue(null);
      setCards(prev => prev.map(c => ({ ...c, votes: 0 })));
      setVotedCards(new Set());
      if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
      setRoundTimeLeft(null);
      setRoundTimeDuration(null);
    });

    socket.on('game_finished', ({ winner, lobbyCode }) => {
      const code = lobbyCode || localStorage.getItem('lastLobbyCode');
      if (lobbyCode) localStorage.setItem('lastLobbyCode', lobbyCode);
      setGameOver({ winner, lobbyCode: code });
      setShowResult(true);
      setCards(prev => prev.map(c => ({ ...c, revealed: true })));
      if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
      setRoundTimeLeft(null);
      setRoundTimeDuration(null);
    });

    socket.on('return_to_lobby', ({ lobbyCode: code }) => {
      sessionStorage.removeItem('isImpostor');
      navigate(code ? `/lobby?code=${code}` : '/');
    });

    return () => {
      socket.disconnect();
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [gameId]);

  const handleVote = (card) => {
    if (card.revealed || !socketRef.current) return;
    if (card.votes >= 3) {
      socketRef.current.emit('flip_card', { gameId, cardId: card.id });
    } else if (!isMaster && phase === 'guess' && !votedCards.has(card.id)) {
      socketRef.current.emit('vote_card', { gameId, cardId: card.id });
      setVotedCards(prev => new Set([...prev, card.id]));
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

  const handleReturnToLobby = () => {
    if (!socketRef.current) return;
    const lobbyCode = gameOver?.lobbyCode || localStorage.getItem('lastLobbyCode');
    socketRef.current.emit('lobby_return', { gameId, lobbyCode });
  };

  const master    = players.find(p => p.role === 'master');
  const agents    = players.filter(p => p.role === 'agent');
  const remaining = cards.filter(c => c.type === 'correct' && !c.revealed).length;

  if (loading) {
    return (
      <div ref={pageRef} className="game-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {t.loading}
      </div>
    );
  }

  return (
    <div ref={pageRef} className={`game-page${gameOver ? ' game-ended' : ''}`}>

      {/* NAVBAR MOBILE */}
      <div className="game-mobile-nav">
        <div className="game-nav-badge">
          {myAvatar && <img src={myAvatar} alt={myNick} />}
          <span className="game-nav-badge-name">{myNick}</span>
        </div>
        <div className="game-nav-title">
          {isMaster
            ? <>{t.giveClueMaster.pre}<span className="hl-yellow">{t.giveClueMaster.hl1}</span>{t.giveClueMaster.mid}<span className="hl-yellow">{t.giveClueMaster.hl2}</span></>
            : isImpostor
            ? <>{t.youAreImpostor.pre}<span className="hl-yellow">{t.youAreImpostor.hl1}</span>{t.youAreImpostor.mid}<span className="hl-yellow">{t.youAreImpostor.hl2}</span></>
            : <>{t.youAreAgent.pre}<span className="hl-yellow">{t.youAreAgent.hl1}</span>{t.youAreAgent.mid}<span className="hl-yellow">{t.youAreAgent.hl2}</span></>}
        </div>
        <button className="ctrl-btn" onClick={toggleMusic} aria-label="Volume">
          {musicOn ? <FaVolumeUp /> : <FaVolumeMute />}
        </button>
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
              <span className="panel-label">{t.masterLabel}</span>
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
              <span className="panel-label">{t.agentsLabel}</span>
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
            <button className="drawer-exit-btn" onClick={() => navigate('/')}>{t.exitGame}</button>
          </div>
        </>
      )}

      {/* TÍTULO */}
      <div className="game-title-row">
        <h1 className="game-title">
          {isMaster
            ? <>{t.giveClueMaster.pre}<span className="hl-yellow">{t.giveClueMaster.hl1}</span>{t.giveClueMaster.mid}<span className="hl-yellow">{t.giveClueMaster.hl2}</span></>
            : isImpostor
            ? <>{t.youAreImpostor.pre}<span className="hl-yellow">{t.youAreImpostor.hl1}</span>{t.youAreImpostor.mid}<span className="hl-yellow">{t.youAreImpostor.hl2}</span></>
            : <>{t.youAreAgent.pre}<span className="hl-yellow">{t.youAreAgent.hl1}</span>{t.youAreAgent.mid}<span className="hl-yellow">{t.youAreAgent.hl2}</span></>}
        </h1>
        <button className="ctrl-btn game-music-btn" onClick={toggleMusic} aria-label="Volume">
          {musicOn ? <FaVolumeUp /> : <FaVolumeMute />}
        </button>
      </div>

      <div className="game-body">

        {/* PAINEL MESTRE */}
        <aside className="panel-master">
          <span className="panel-label">{t.masterLabel}</span>
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

          {roundTimeLeft !== null && (
            <div className={`round-timer-bar${roundTimeLeft <= 10 ? ' urgent' : ''}`}>
              <div
                className="round-timer-fill"
                style={{ width: `${(roundTimeLeft / (roundTimeDuration || roundTimeLeft)) * 100}%` }}
              />
              <span className="round-timer-label">⏱ {roundTimeLeft}s</span>
            </div>
          )}

          <div className="card-grid">
            {cards.map(card => (
              <div
                key={card.id}
                className={`game-card${card.revealed ? ' revealed' : ''}${!card.revealed && card.votes >= 3 ? ' ready' : ''}`}
                onClick={() => handleVote(card)}
              >
                <img
                  src={
                    isMaster || card.revealed
                      ? CARD_IMG[card.type]
                      : isImpostor && card.type === 'assassin'
                      ? CARD_IMG['assassin']
                      : cartaBege
                  }
                  alt={card.word}
                  className="card-img"
                />
                {!card.revealed && card.votes > 0 && (
                  <div className={`card-votes${votedCards.has(card.id) ? ' my-vote' : ''}`}>
                    <span className="vote-count">{card.votes}</span>
                  </div>
                )}
                <span className="card-word">{card.word}</span>
              </div>
            ))}
          </div>

          {/* LOG MOBILE */}
          <div className="mobile-log">
            <span className="panel-label">{t.roundLog}</span>
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

          {/* ÁREA INFERIOR: botão de retorno (fim de jogo) ou barra de dica */}
          {gameOver ? (
            isAdmin && (
              <button className="return-lobby-btn" onClick={handleReturnToLobby}>
                <FaChevronLeft /> {t.returnToLobby}
              </button>
            )
          ) : (
            <>
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
                      placeholder={t.cluePlaceholder}
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
            </>
          )}
        </div>

        {/* SIDEBAR */}
        <aside className="panel-sidebar">
          <div className="sidebar-agents">
            <span className="panel-label">{t.agentsLabel}</span>
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
            <span className="panel-label">{t.roundLog}</span>
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
            <span className="remaining-label">{t.remaining}</span>
            <span className="remaining-num">{remaining}</span>
          </div>
        </aside>

      </div>

      {/* MODAL DE RESULTADO */}
      {gameOver && showResult && (
        <div className="result-overlay">
          <div className={`result-card${gameOver.winner === 'agents' ? ' agents' : ''}`}>
            <button className="result-close-btn" onClick={() => setShowResult(false)}>✕</button>
            <span className="result-label">{t.gameOver}</span>
            <p className={`result-title${gameOver.winner === 'agents' ? ' agents' : ''}`}>
              {gameOver.winner === 'impostor' ? t.impostorWon : t.agentsWon}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
