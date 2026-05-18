import "./Lobby.css";
import logo from "../assets/logoShadowCode.png";
import {
  FaBookmark, FaCog, FaCrown, FaUsers, FaLink, FaCopy,
  FaPlay, FaRandom, FaSync, FaUserFriends, FaSignInAlt, FaUser,
} from "react-icons/fa";
import { useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export default function Lobby() {
  const navigate = useNavigate();
  const location = useLocation();

  const nick      = localStorage.getItem('nick')           || 'Jogador';
  const avatarUrl = localStorage.getItem('selectedAvatar') || '';
  const isAdmin   = localStorage.getItem('userRole') === 'admin';

  const searchParams = new URLSearchParams(location.search);
  const codeParam    = searchParams.get('code');

  const [gameCode, setGameCode] = useState(codeParam || '---');
  const [players,  setPlayers]  = useState([]);
  const [copied,   setCopied]   = useState(false);
  const socketRef = useRef(null);

  useEffect(() => {
    const socket = io(SOCKET_URL);
    socketRef.current = socket;

    socket.on('connect', () => {
      if (isAdmin) {
        socket.emit('lobby_create', { nick, avatar: avatarUrl });
      } else {
        socket.emit('lobby_join_code', { code: codeParam, nick, avatar: avatarUrl });
      }
    });

    socket.on('lobby_created', ({ code }) => setGameCode(code));
    socket.on('lobby_update',  setPlayers);

    socket.on('lobby_error', ({ message }) => {
      alert(message);
      navigate('/');
    });

    socket.on('lobby_kicked', () => {
      alert('Você foi removido da sala');
      navigate('/');
    });

    socket.on('game_ready', ({ gameId, avatars }) => {
      localStorage.setItem(`avatars_${gameId}`, JSON.stringify(avatars));
      navigate(`/game?gameId=${gameId}`);
    });

    socket.on('game_start_error', ({ message }) => {
      alert(message);
    });

    return () => socket.disconnect();
  }, []);

  const myId       = socketRef.current?.id;
  const myPlayer   = players.find(p => p.socketId === myId);
  const myRole     = myPlayer?.gameRole;
  const roleChosen = !!myPlayer;

  const master     = players.find(p => p.gameRole === 'master');
  const agents     = players.filter(p => p.gameRole === 'agent');
  const maxPlayers = 15;

  const emit = (event, data) => socketRef.current?.emit(event, data);

  const chooseRole = (gameRole) => {
    localStorage.setItem('gameRole', gameRole);
    emit('lobby_choose_role', { code: gameCode, gameRole });
  };
  const handleLeave  = ()                        => { localStorage.removeItem('gameRole'); emit('lobby_leave',      { code: gameCode }); };
  const handleKick   = (targetSocketId)          => emit('lobby_kick',        { code: gameCode, targetSocketId });
  const handleMove   = (targetSocketId, newRole) => emit('lobby_move_role',   { code: gameCode, targetSocketId, newRole });
  const handleReset  = ()                        => emit('lobby_reset',       { code: gameCode });
  const handleRandom = ()                        => emit('lobby_randomize',   { code: gameCode });

  const handleCopy = () => {
    navigator.clipboard.writeText(gameCode).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="lobby-page">

      {/* ===== NAVBAR ===== */}
      <nav className="lobby-nav">
        <div className="nav-left">
          <button className="nav-player-badge">
            <FaUserFriends />
            <span className="badge-name">{nick}</span>
            <span className="badge-count">{players.length}</span>
          </button>
        </div>

        <div className="nav-center">
          <img src={logo} alt="Shadow Code" className="nav-logo" />
        </div>

        <div className="nav-right">
          <button className="nav-btn"><FaBookmark /> Regras</button>
          <button className="nav-btn"><FaCog /> Configurações</button>
        </div>

        <button className="help-btn" aria-label="Ajuda">?</button>
      </nav>

      {/* ===== MAIN ===== */}
      <div className="lobby-main">

        {/* MESTRE */}
        <div className="mestre-card">
          <h3 className="section-title">MESTRE</h3>
          <div className="mestre-crown"><FaCrown /></div>

          <div className="mestre-avatar-wrap">
            {master ? (
              <>
                <div className="lobby-avatar-ring">
                  <img src={master.avatar} alt={master.nick} />
                </div>
                {isAdmin && master.socketId !== myId && (
                  <div className="master-admin-actions">
                    <button
                      className="admin-action-btn kick-btn"
                      onClick={() => handleKick(master.socketId)}
                      title="Expulsar"
                    >× Expulsar</button>
                    <button
                      className="admin-action-btn move-btn"
                      onClick={() => handleMove(master.socketId, 'agent')}
                      title="Mover para agentes"
                    >↓ Agentes</button>
                  </div>
                )}
              </>
            ) : (
              <div className="lobby-avatar-ring empty-ring">
                <FaUser />
              </div>
            )}
          </div>

          <p className="mestre-name">{master ? master.nick : '—'}</p>
          <p className="mestre-desc">
            {master
              ? 'As dicas estão em suas mãos.'
              : 'Nenhum mestre ainda.'}
          </p>

          {myRole === 'master' ? (
            <button className="lobby-leave-btn" onClick={handleLeave}>✕ Sair</button>
          ) : !roleChosen && (
            <button
              className="mestre-enter-btn"
              onClick={() => chooseRole('master')}
              disabled={!!master}
              style={master ? { opacity: 0.4, cursor: 'not-allowed' } : {}}
            >
              {master ? 'Ocupado' : 'Entrar'}
            </button>
          )}
        </div>

        {/* AGENTES */}
        <div className="agentes-card">
          <h3 className="section-title">AGENTES</h3>

          <div className="agentes-count-row">
            <FaUsers className="agentes-icon" />
            <span className="agentes-number">3 - {maxPlayers}</span>
          </div>
          <p className="agentes-label-sub">JOGADORES</p>

          <p className="agentes-desc">
            Convide seus amigos para entrar na partida.<br />
            Quanto mais agentes, mais desafiador!
          </p>

          <div className="team-header">
            NA EQUIPE ({players.length}/{maxPlayers})
          </div>

          <div className="team-players">
            {agents.length === 0 ? (
              <p className="no-players-msg">Nenhum agente ainda</p>
            ) : (
              agents.map(p => (
                <div className="team-player" key={p.socketId}>
                  <div className="team-avatar-wrap">
                    <div className="lobby-avatar-ring small">
                      <img src={p.avatar} alt={p.nick} />
                    </div>
                    {isAdmin && p.socketId !== myId && (
                      <div className="agent-admin-actions">
                        <button
                          className="admin-action-btn kick-btn small"
                          onClick={() => handleKick(p.socketId)}
                          title="Expulsar"
                        >×</button>
                        <button
                          className="admin-action-btn move-btn small"
                          onClick={() => handleMove(p.socketId, 'master')}
                          title="Promover a mestre"
                        >↑</button>
                      </div>
                    )}
                  </div>
                  <span className="team-player-name">{p.nick}</span>
                </div>
              ))
            )}
          </div>

          <div className="invite-bar">
            <FaLink className="invite-icon" />
            <span className="invite-text">{gameCode}</span>
            <button className="invite-copy" onClick={handleCopy} aria-label="Copiar código">
              {copied ? '✓' : <FaCopy />}
            </button>
          </div>

          {isAdmin && (
            <div className="agentes-actions">
              <button className="agentes-action-btn" onClick={handleRandom}>
                <FaRandom /> Randomizar Agentes
              </button>
              <button className="agentes-action-btn" onClick={handleReset}>
                <FaSync /> Redefinir Agentes
              </button>
            </div>
          )}

          {myRole === 'agent' ? (
            <button className="lobby-leave-btn" onClick={handleLeave}>✕ Sair</button>
          ) : !roleChosen && (
            <button className="agentes-enter-btn" onClick={() => chooseRole('agent')}>
              <FaSignInAlt /> Entrar
            </button>
          )}
        </div>

      </div>

      {/* ===== INICIAR JOGO (admin only) ===== */}
      {isAdmin && (
        <div className="lobby-footer">
          <button className="start-btn" onClick={() => emit('lobby_start', { code: gameCode })}>
            <FaPlay /> INICIAR JOGO
          </button>
        </div>
      )}

    </div>
  );
}
