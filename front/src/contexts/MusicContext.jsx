import { createContext, useContext, useState, useEffect, useRef } from "react";

const MusicContext = createContext(null);

export function MusicProvider({ children }) {
  const [musicOn, setMusicOn] = useState(true);
  const audioRef = useRef(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = !musicOn;
    if (musicOn) audio.play().catch(() => {});
  }, [musicOn]);

  useEffect(() => {
    const playOnFirstClick = () => {
      const audio = audioRef.current;
      if (audio && musicOn) audio.play().catch(() => {});
    };
    window.addEventListener("click", playOnFirstClick, { once: true });
    return () => window.removeEventListener("click", playOnFirstClick);
  }, []);

  const toggleMusic = () => setMusicOn((prev) => !prev);

  return (
    <MusicContext.Provider value={{ musicOn, toggleMusic }}>
      <audio ref={audioRef} src="/musica.mpeg" autoPlay loop />
      {children}
    </MusicContext.Provider>
  );
}

export function useMusic() {
  return useContext(MusicContext);
}
