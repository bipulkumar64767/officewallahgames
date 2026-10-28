import { Link } from 'react-router-dom';
import './Navbar.css';

const Navbar = () => {
  return (
    <nav className="navbar">
      <Link to="/" className="navbar-brand">🎮 OfficeWallahGames</Link>
      <div className="navbar-links">
        <Link to="/">Home</Link>
        <Link to="/games">Games</Link>
      </div>
    </nav>
  );
};

export default Navbar;
