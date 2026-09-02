import { BrowserRouter, Routes, Route, Navigate, Link, useLocation, useNavigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './AuthContext'
import LoginPage from './pages/LoginPage'
import SquadPage from './pages/SquadPage'
import LeaderboardPage from './pages/LeaderboardPage'
import HomePage from './pages/HomePage'
import LeaguesPage from './pages/LeaguesPage'
import MatchesPage from './pages/MatchesPage'
import './App.css'

function Nav() {
  const { isLoggedIn, logout } = useAuth()
  const navigate = useNavigate()

  const goProtected = (path: string) => {
    if (isLoggedIn) {
      navigate(path)
    } else {
      navigate('/login', { state: { from: { pathname: path } } })
    }
  }

  return (
    <nav className="navbar">
      <Link to="/home" className="brand">
        <img className="brand-logo" src="/images/logo.png" alt="" />
        Any Given XI
      </Link>
      <div className="nav-links">
        <Link to="/matches">Matches</Link>
        <button className="nav-link-button" onClick={() => goProtected('/squad')}>
          Squad
        </button>
        <Link to="/leaderboard">Leaderboard</Link>
        <button className="nav-link-button" onClick={() => goProtected('/leagues')}>
          Leagues
        </button>
        {isLoggedIn ? (
          <button className="auth-button" onClick={logout}>Log out</button>
        ) : (
          <Link to="/login" className="auth-button">Log In</Link>
        )}
      </div>
    </nav>
  )
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isLoggedIn } = useAuth()
  return isLoggedIn ? <>{children}</> : <Navigate to="/login" />
}

function AppRoutes() {
  const { isLoggedIn } = useAuth()

  return (
    <>
      <Nav />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/home" element={<HomePage />} />
        <Route path="/" element={<Navigate to="/home" />} />
        <Route
          path="/squad"
          element={
            <ProtectedRoute>
              <SquadPage />
            </ProtectedRoute>
          }
        />
        <Route path="/leaderboard" element={<LeaderboardPage />} />
        <Route
          path="/leagues"
          element={
            <ProtectedRoute>
              <LeaguesPage />
            </ProtectedRoute>
          }
        />
        <Route path="/matches" element={<MatchesPage />} />
        <Route path="*" element={<Navigate to="/home" />} />
      </Routes>
    </>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App