import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api'

interface Squad {
  id: number
  budget_remaining: number
  squad_players: { player_id: number; is_starting: boolean; is_captain: boolean }[]
}

export default function HomePage() {
  const [squad, setSquad] = useState<Squad | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .get('/squad')
      .then((res) => setSquad(res.data))
      .catch(() => setSquad(null))
      .finally(() => setLoading(false))
  }, [])

  const startersCount = squad?.squad_players.filter((sp) => sp.is_starting).length || 0
  const squadCount = squad?.squad_players.length || 0

  return (
    <div className="page home-page">
      <div className="hero">
        <h1>Welcome back</h1>
        <p className="hero-subtitle">Here's where things stand for Gameweek 1.</p>
      </div>

      {!loading && (
        <div className="dashboard-cards">
          <Link to="/squad" className="dashboard-card">
            <div className="card-label">Squad</div>
            {squad ? (
              <>
                <div className="card-main">{squadCount}/15 players</div>
                <div className="card-sub">
                  {startersCount}/11 starters set · £{squad.budget_remaining.toFixed(1)}m left
                </div>
              </>
            ) : (
              <div className="card-main">No squad yet — build one</div>
            )}
          </Link>

          <Link to="/leaderboard" className="dashboard-card">
            <div className="card-label">Leaderboard</div>
            <div className="card-main">See where you rank</div>
            <div className="card-sub">Gameweek 1 standings</div>
          </Link>

          <div className="dashboard-card disabled">
            <div className="card-label">Leagues</div>
            <div className="card-main">Coming soon</div>
            <div className="card-sub">Compete with friends</div>
          </div>
        </div>
      )}
    </div>
  )
}