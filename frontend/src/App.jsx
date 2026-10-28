import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Navbar from './components/Navbar';
import LoginModal from './components/LoginModal';
import Home from './pages/Home';
import TicTacToeLobby from './pages/TicTacToeLobby';
import LudoLobby from './pages/LudoLobby';
import WordGridLobby from './pages/WordGridLobby';

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
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
