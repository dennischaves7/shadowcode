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
import icone11 from "../assets/icone11.png";
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
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "../contexts/LanguageContext";
import { useMusic } from "../contexts/MusicContext";

const avatarOptions = [
  icone1, icone2, icone3, icone10,
  icone4, icone5, icone6, icone7,
  icone8, icone9, icone11,
];

export default function Home() {
  const navigate = useNavigate();
  const { t, toggleLanguage } = useLanguage();
  const { musicOn, toggleMusic } = useMusic();

  const [avatarUrl, setAvatarUrl] = useState(icone1);
  const [showSelector, setShowSelector] = useState(false);
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [nick, setNick] = useState("");

  useEffect(() => {
    const savedAvatar = localStorage.getItem("selectedAvatar");
    if (savedAvatar) setAvatarUrl(savedAvatar);
  }, []);

  const saveAvatar = (url) => {
    setAvatarUrl(url);
    localStorage.setItem("selectedAvatar", url);
  };

  const handlePlay = () => {
    localStorage.setItem('userRole', 'admin');
    localStorage.setItem('nick', nick.trim() || t.defaultNick);
    navigate("/lobby");
  };

  const handleEnterCode = () => {
    if (!codeInput.trim()) return;
    localStorage.setItem('userRole', 'player');
    localStorage.setItem('nick', nick.trim() || t.defaultNick);
    navigate(`/lobby?code=${codeInput.trim()}`);
  };

  return (
    <div className="container">

      {/* BOTÕES FIXOS */}
      <div className="music-controls">
        <button className="ctrl-btn" onClick={toggleMusic} aria-label="Música">
          <FaMusic />
        </button>
        <button className="ctrl-btn" onClick={toggleMusic} aria-label="Volume">
          {musicOn ? <FaVolumeUp /> : <FaVolumeMute />}
        </button>
      </div>

      <button className="language" onClick={toggleLanguage} aria-label={t.languageLabel}>
        {t.languageCode}
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
                  placeholder={t.nickPlaceholder}
                  className="nick-input"
                  value={nick}
                  onChange={(e) => setNick(e.target.value)}
                />
              </div>
            </div>

            <button className="play" onClick={handlePlay}>
              <FaPlay /> {t.play}
            </button>

            <button className="enter-code" onClick={() => setShowCodeModal(true)}>
              <FaKey /> {t.enterCode}
            </button>
          </div>

          {/* CARD DIREITA */}
          <div className="card info-card">
            <h3>{t.howItWorks}</h3>

            <div className="info-item">
              <span><FaCode /></span>
              <p>{t.secretCode}</p>
            </div>

            <div className="info-item">
              <span><FaPuzzlePiece /></span>
              <p>{t.solveChallenges}</p>
            </div>

            <div className="info-item">
              <span><FaBolt /></span>
              <p>{t.fastestWins}</p>
            </div>
          </div>

        </div>
      </div>

      {/* MODAL: ENTRAR COM CÓDIGO */}
      {showCodeModal && (
        <div className="modal-overlay" onClick={() => { setShowCodeModal(false); setCodeInput(""); }}>
          <div className="modal-box code-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{t.enterCodeTitle}</h3>
            <div className="input-wrapper" style={{ margin: "1rem 0" }}>
              <FaKey className="input-icon" />
              <input
                type="text"
                className="nick-input"
                placeholder={t.codePlaceholder}
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
                {t.cancel}
              </button>
              <button className="modal-confirm" onClick={handleEnterCode}>
                {t.enter} <FaArrowRight />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: SELETOR DE AVATAR */}
      {showSelector && (
        <div className="modal-overlay" onClick={() => setShowSelector(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h3>{t.chooseAvatar}</h3>
            <div className="avatar-grid">
              {avatarOptions.map((url, index) => (
                <img
                  key={index}
                  src={url}
                  alt={`${t.avatarAlt} ${index + 1}`}
                  className="avatar-option"
                  onClick={() => { saveAvatar(url); setShowSelector(false); }}
                />
              ))}
            </div>
            <button className="modal-close" onClick={() => setShowSelector(false)}>
              {t.close}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
