import "./Home.css";
import logo from "../assets/logoShadowCode.png";
import icone1 from "../assets/icone1.png";
import icone2 from "../assets/icone2.png";
import icone3 from "../assets/icone3.png";
import icone4 from "../assets/icone4.png";
import icone5 from "../assets/icone5.png";
import icone6 from "../assets/icone6.png";
import icone7 from "../assets/icone7.png";
import icone8 from "../assets/icone8.png";
import icone9 from "../assets/icone9.png";
import icone10 from "../assets/icone10.png";
import icone11 from "../assets/icone11.jpg";
import {
  FaPlay,
  FaMusic,
  FaVolumeUp,
  FaVolumeMute,
  FaPuzzlePiece,
  FaBolt,
  FaCode,
  FaUser,
  FaKey,
  FaArrowRight,
} from "react-icons/fa";
import { MdEdit } from "react-icons/md";
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

const MUSIC_SRC = "/musica.mp3";

const translations = {
  pt: {
    languageCode: "PT-BR",
    languageLabel: "Trocar idioma",
    nickPlaceholder: "Digite seu nick...",
    play: "JOGAR",
    enterCode: "Entrar com código",
    enterCodeTitle: "Insira o código da partida",
    codePlaceholder: "Ex: ABC-123",
    cancel: "Cancelar",
    enter: "Entrar",
    howItWorks: "COMO FUNCIONA",
    secretCode: "O mestre dá uma dica: uma palavra e um número para guiar os agentes",
    solveChallenges: "Os agentes votam nas cartas — 3 votos revelam uma carta do tabuleiro",
    fastestWins: "Cuidado: um impostor secreto tenta fazer os agentes virarem a carta errada",
    chooseAvatar: "Escolha seu Avatar",
    close: "Fechar",
    avatarAlt: "Avatar",
  },
  en: {
    languageCode: "EN-US",
    languageLabel: "Change language",
    nickPlaceholder: "Enter your nickname...",
    play: "PLAY",
    enterCode: "Enter with code",
    enterCodeTitle: "Enter the game code",
    codePlaceholder: "Ex: ABC-123",
    cancel: "Cancel",
    enter: "Enter",
    howItWorks: "HOW IT WORKS",
    secretCode: "The master gives a clue: one word and a number to guide the agents",
    solveChallenges: "Agents vote on cards — 3 votes flip a card on the board",
    fastestWins: "Watch out: a secret impostor tries to make agents flip the wrong card",
    chooseAvatar: "Choose your Avatar",
    close: "Close",
    avatarAlt: "Avatar",
  },
  es: {
    languageCode: "ES",
    languageLabel: "Cambiar idioma",
    nickPlaceholder: "Escribe tu apodo...",
    play: "JUGAR",
    enterCode: "Entrar con código",
    enterCodeTitle: "Inserta el código de partida",
    codePlaceholder: "Ej: ABC-123",
    cancel: "Cancelar",
    enter: "Entrar",
    howItWorks: "COMO FUNCIONA",
    secretCode: "El maestro da una pista: una palabra y un número para guiar a los agentes",
    solveChallenges: "Los agentes votan en cartas — 3 votos revelan una carta del tablero",
    fastestWins: "Cuidado: un impostor secreto intenta que los agentes elijan la carta equivocada",
    chooseAvatar: "Elige tu Avatar",
    close: "Cerrar",
    avatarAlt: "Avatar",
  },
  fr: {
    languageCode: "FR",
    languageLabel: "Changer de langue",
    nickPlaceholder: "Entrez votre pseudo...",
    play: "JOUER",
    enterCode: "Entrer avec code",
    enterCodeTitle: "Entrez le code de partie",
    codePlaceholder: "Ex: ABC-123",
    cancel: "Annuler",
    enter: "Entrer",
    howItWorks: "COMMENT ÇA MARCHE",
    secretCode: "Le maître donne un indice : un mot et un chiffre pour guider les agents",
    solveChallenges: "Les agents votent sur les cartes — 3 votes révèlent une carte du plateau",
    fastestWins: "Attention : un imposteur secret tente de faire choisir la mauvaise carte",
    chooseAvatar: "Choisissez votre Avatar",
    close: "Fermer",
    avatarAlt: "Avatar",
  },
  it: {
    languageCode: "IT",
    languageLabel: "Cambia lingua",
    nickPlaceholder: "Inserisci il tuo nick...",
    play: "GIOCA",
    enterCode: "Entra con codice",
    enterCodeTitle: "Inserisci il codice partita",
    codePlaceholder: "Es: ABC-123",
    cancel: "Annulla",
    enter: "Entra",
    howItWorks: "COME FUNZIONA",
    secretCode: "Il maestro dà un indizio: una parola e un numero per guidare gli agenti",
    solveChallenges: "Gli agenti votano sulle carte — 3 voti rivelano una carta del tabellone",
    fastestWins: "Attenzione: un impostore segreto cerca di far scegliere la carta sbagliata",
    chooseAvatar: "Scegli il tuo Avatar",
    close: "Chiudi",
    avatarAlt: "Avatar",
  },
  zh: {
    languageCode: "ZH",
    languageLabel: "切换语言",
    nickPlaceholder: "输入你的昵称...",
    play: "开始",
    enterCode: "用代码进入",
    enterCodeTitle: "输入游戏代码",
    codePlaceholder: "例: ABC-123",
    cancel: "取消",
    enter: "进入",
    howItWorks: "玩法说明",
    secretCode: "主人给出提示：一个词和一个数字，引导特工找到正确的卡片",
    solveChallenges: "特工对卡片投票——3票即可翻开棋盘上的一张卡片",
    fastestWins: "小心：一名秘密内鬼试图让特工翻开错误的卡片",
    chooseAvatar: "选择你的头像",
    close: "关闭",
    avatarAlt: "头像",
  },
};

const languageOptions = ["pt", "en", "es", "fr", "it", "zh"];

const avatarOptions = [
  icone1, icone2, icone3, icone10,
  icone4, icone5, icone6, icone7,
  icone8, icone9, icone11,
];

export default function Home() {
  const navigate = useNavigate();

  const [avatarUrl, setAvatarUrl] = useState(icone1);
  const [showSelector, setShowSelector] = useState(false);
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [musicOn, setMusicOn] = useState(true);
  const [language, setLanguage] = useState("pt");
  const [nick, setNick] = useState("");
  const audioRef = useRef(null);
  const text = translations[language];

  useEffect(() => {
    const savedAvatar = localStorage.getItem("selectedAvatar");
    if (savedAvatar) setAvatarUrl(savedAvatar);

    const savedLanguage = localStorage.getItem("selectedLanguage");
    if (savedLanguage && translations[savedLanguage]) setLanguage(savedLanguage);
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = !musicOn;
    if (musicOn) audio.play().catch(() => {});
  }, [musicOn]);

  useEffect(() => {
    const playMusic = () => {
      const audio = audioRef.current;
      if (audio && musicOn) audio.play().catch(() => {});
    };
    window.addEventListener("click", playMusic, { once: true });
    return () => window.removeEventListener("click", playMusic);
  }, [musicOn]);

  const saveAvatar = (url) => {
    setAvatarUrl(url);
    localStorage.setItem("selectedAvatar", url);
  };

  const toggleLanguage = () => {
    const next = languageOptions[(languageOptions.indexOf(language) + 1) % languageOptions.length];
    setLanguage(next);
    localStorage.setItem("selectedLanguage", next);
  };

  const handlePlay = () => {
    localStorage.setItem('userRole', 'admin');
    localStorage.setItem('nick', nick.trim() || 'Admin');
    navigate("/lobby");
  };

  const handleEnterCode = () => {
    if (!codeInput.trim()) return;
    localStorage.setItem('userRole', 'player');
    localStorage.setItem('nick', nick.trim() || 'Jogador');
    navigate(`/lobby?code=${codeInput.trim()}`);
  };

  return (
    <div className="container">
      <audio ref={audioRef} src={MUSIC_SRC} autoPlay loop />

      {/* BOTÕES FIXOS */}
      <div className="music-controls">
        <button className="ctrl-btn" onClick={() => setMusicOn(!musicOn)} aria-label="Música">
          <FaMusic />
        </button>
        <button className="ctrl-btn" onClick={() => setMusicOn(!musicOn)} aria-label="Volume">
          {musicOn ? <FaVolumeUp /> : <FaVolumeMute />}
        </button>
      </div>

      <button className="language" onClick={toggleLanguage} aria-label={text.languageLabel}>
        {text.languageCode}
      </button>

      {/* LOGO */}
      <div className="header">
        <img src={logo} alt="Shadow Code" className="header-logo" />
      </div>

      {/* CONTEÚDO */}
      <div className="main">
        <div className="content">

          {/* CARD ESQUERDA */}
          <div className="card">
            <div className="avatar">
              <div className="avatar-ring">
                <img src={avatarUrl} alt="avatar" />
              </div>
              <div className="edit-icon" onClick={() => setShowSelector(true)}>
                <MdEdit />
              </div>
            </div>

            <div className="input-group">
              <div className="input-wrapper">
                <FaUser className="input-icon" />
                <input
                  type="text"
                  placeholder={text.nickPlaceholder}
                  className="nick-input"
                  value={nick}
                  onChange={(e) => setNick(e.target.value)}
                />
              </div>
            </div>

            <button className="play" onClick={handlePlay}>
              <FaPlay /> {text.play}
            </button>

            <button className="enter-code" onClick={() => setShowCodeModal(true)}>
              <FaKey /> {text.enterCode}
            </button>
          </div>

          {/* CARD DIREITA */}
          <div className="card info-card">
            <h3>{text.howItWorks}</h3>

            <div className="info-item">
              <span><FaCode /></span>
              <p>{text.secretCode}</p>
            </div>

            <div className="info-item">
              <span><FaPuzzlePiece /></span>
              <p>{text.solveChallenges}</p>
            </div>

            <div className="info-item">
              <span><FaBolt /></span>
              <p>{text.fastestWins}</p>
            </div>
          </div>

        </div>
      </div>

      {/* MODAL: ENTRAR COM CÓDIGO */}
      {showCodeModal && (
        <div className="modal-overlay" onClick={() => { setShowCodeModal(false); setCodeInput(""); }}>
          <div className="modal-box code-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{text.enterCodeTitle}</h3>
            <div className="input-wrapper" style={{ margin: "1rem 0" }}>
              <FaKey className="input-icon" />
              <input
                type="text"
                className="nick-input"
                placeholder={text.codePlaceholder}
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                maxLength={10}
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && handleEnterCode()}
              />
            </div>
            <div className="modal-actions">
              <button
                className="modal-cancel"
                onClick={() => { setShowCodeModal(false); setCodeInput(""); }}
              >
                {text.cancel}
              </button>
              <button className="modal-confirm" onClick={handleEnterCode}>
                {text.enter} <FaArrowRight />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: SELETOR DE AVATAR */}
      {showSelector && (
        <div className="modal-overlay" onClick={() => setShowSelector(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h3>{text.chooseAvatar}</h3>
            <div className="avatar-grid">
              {avatarOptions.map((url, index) => (
                <img
                  key={index}
                  src={url}
                  alt={`${text.avatarAlt} ${index + 1}`}
                  className="avatar-option"
                  onClick={() => { saveAvatar(url); setShowSelector(false); }}
                />
              ))}
            </div>
            <button className="modal-close" onClick={() => setShowSelector(false)}>
              {text.close}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
