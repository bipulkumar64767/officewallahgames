import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import TicTacToeLobby from './pages/TicTacToeLobby';

function App() {
  return (
    <Router>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/games" element={<Home />} />
        <Route path="/games/tictactoe" element={<TicTacToeLobby />} />
      </Routes>
    </Router>
  );
}

export default App;
