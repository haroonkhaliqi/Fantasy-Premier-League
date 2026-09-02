import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom'
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
  if (!isLoggedIn) return null

  return (
    <nav className="navbar">
      <Link to="/home" className="brand">Any Given XI</Link>
      <div className="nav-links">
        <Link to="/matches">Matches</Link>
        <Link to="/squad">Squad</Link>
        <Link to="/leaderboard">Leaderboard</Link>
        <Link to="/leagues">Leagues</Link>
        <button onClick={logout}>Log out</button>
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
        <Route path="/login" element={isLoggedIn ? <Navigate to="/home" /> : <LoginPage />} />
        <Route
          path="/home"
          element={
            <ProtectedRoute>
              <HomePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/squad"
          element={
            <ProtectedRoute>
              <SquadPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/leaderboard"
          element={
            <ProtectedRoute>
              <LeaderboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/leagues"
          element={
            <ProtectedRoute>
              <LeaguesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/matches"
          element={
            <ProtectedRoute>
              <MatchesPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to={isLoggedIn ? '/squad' : '/login'} />} />
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