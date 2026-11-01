import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Navbar from './components/Navbar';
import LoginModal from './components/LoginModal';
import Home from './pages/Home';
import TicTacToeLobby from './pages/TicTacToeLobby';
import LudoLobby from './pages/LudoLobby';
import WordGridLobby from './pages/WordGridLobby';
import ConnectDropLobby from './pages/ConnectDropLobby';
import SnakeGame from './pages/SnakeGame';
import Cyber2048 from './pages/Cyber2048';
import SpeedChess from './pages/SpeedChess';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Navbar />
        <LoginModal />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/games" element={<Home />} />
          <Route path="/games/tictactoe" element={<TicTacToeLobby />} />
          <Route path="/games/ludo" element={<LudoLobby />} />
          <Route path="/games/wordgrid" element={<WordGridLobby />} />
          <Route path="/games/connectdrop" element={<ConnectDropLobby />} />
          <Route path="/games/snake" element={<SnakeGame />} />
          <Route path="/games/2048" element={<Cyber2048 />} />
          <Route path="/games/chess" element={<SpeedChess />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
