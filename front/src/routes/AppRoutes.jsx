import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LanguageProvider } from "../contexts/LanguageContext";
import { MusicProvider } from "../contexts/MusicContext";

import Home from "../pages/Home";
import Lobby from "../pages/Lobby";
import Game from "../pages/Game";

export default function AppRoutes() {
  return (
    <MusicProvider>
      <LanguageProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/lobby" element={<Lobby />} />
            <Route path="/game" element={<Game />} />
          </Routes>
        </BrowserRouter>
      </LanguageProvider>
    </MusicProvider>
  );
}
