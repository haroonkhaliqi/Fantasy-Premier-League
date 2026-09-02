import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../api'
import { useAuth } from '../AuthContext'

interface Squad {
  id: number
  budget_remaining: number
  squad_players: { player_id: number; is_starting: boolean; is_captain: boolean }[]
}

interface League {
  id: number
  name: string
  invite_code: string
  owner_id: number
}

export default function HomePage() {
  const { isLoggedIn } = useAuth()
  const navigate = useNavigate()
  const [squad, setSquad] = useState<Squad | null>(null)
  const [leagues, setLeagues] = useState<League[]>([])
  const [loading, setLoading] = useState(true)

  const [activeForm, setActiveForm] = useState<'create' | 'join' | null>(null)
  const [leagueName, setLeagueName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [formError, setFormError] = useState('')
  const [formMessage, setFormMessage] = useState('')

  const loadData = async () => {
    if (!isLoggedIn) {
      setSquad(null)
      setLeagues([])
      setLoading(false)
      return
    }
    try {
      const squadRes = await api.get('/squad')
      setSquad(squadRes.data)
    } catch {
      setSquad(null)
    }
    try {
      const leaguesRes = await api.get('/leagues/mine')
      setLeagues(leaguesRes.data)
    } catch {
      setLeagues([])
    }
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [isLoggedIn])

  const openForm = (form: 'create' | 'join') => {
    if (!isLoggedIn) {
      navigate('/login', { state: { from: { pathname: '/home' } } })
      return
    }
    setActiveForm(activeForm === form ? null : form)
    setFormError('')
    setFormMessage('')
  }

  const goToLeaderboard = () => {
    if (!isLoggedIn) {
      navigate('/login', { state: { from: { pathname: '/leaderboard' } } })
      return
    }
    navigate('/leaderboard')
  }

  const createLeague = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    try {
      await api.post('/leagues', { name: leagueName })
      setFormMessage('League created!')
      setLeagueName('')
      loadData()
    } catch (err: any) {
      setFormError(err.response?.data?.detail || 'Failed to create league')
    }
  }

  const joinLeague = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    try {
      await api.post('/leagues/join', { invite_code: joinCode })
      setFormMessage('Joined league!')
      setJoinCode('')
      loadData()
    } catch (err: any) {
      setFormError(err.response?.data?.detail || 'Failed to join league')
    }
  }

  return (
    <div className="page home-page">
      <div className="hero">
        <h1>Welcome to Any Given XI Fantasy Fútbol</h1>
        {/*Here&apos;s where*/}
        <p className="hero-subtitle">Compete with your friends for the Fantasy Throne!</p>
      </div>

      <div className="quick-actions">
        <button className="quick-action" onClick={() => openForm('create')}>
          <div className="quick-action-image-wrap">
            <img className="quick-action-image" src="/images/create-league.png" alt="" />
          </div>
          <div className="quick-action-label">
            <span className="quick-action-badge">+</span>
            Create League
          </div>
        </button>
        <button className="quick-action" onClick={() => openForm('join')}>
          <div className="quick-action-image-wrap">
            <img className="quick-action-image" src="/images/join-league.png" alt="" />
          </div>
          <div className="quick-action-label">
            <span className="quick-action-badge">#</span>
            Join League
          </div>
        </button>
        <button className="quick-action" onClick={goToLeaderboard}>
          <div className="quick-action-image-wrap">
            <img className="quick-action-image" src="/images/leaderboard.png" alt="" />
          </div>
          <div className="quick-action-label">
            <span className="quick-action-badge">🏆</span>
            World Leaderboard
          </div>
        </button>
      </div>

      {activeForm && (
        <div className="quick-action-form">
          {formError && <p className="error">{formError}</p>}
          {formMessage && <p className="success">{formMessage}</p>}
          {activeForm === 'create' ? (
            <form onSubmit={createLeague}>
              <input
                type="text"
                placeholder="League name"
                value={leagueName}
                onChange={(e) => setLeagueName(e.target.value)}
                required
              />
              <button type="submit">Create</button>
            </form>
          ) : (
            <form onSubmit={joinLeague}>
              <input
                type="text"
                placeholder="Invite code"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                required
              />
              <button type="submit">Join</button>
            </form>
          )}
        </div>
      )}

      <h2>Your Leagues</h2>
      {loading ? (
        <p className="hint">Loading...</p>
      ) : leagues.length === 0 ? (
        <p className="hint">
          {isLoggedIn
            ? "You're not in any leagues yet — create or join one above."
            : 'Log in to see your leagues.'}
        </p>
      ) : (
        <ul className="league-list">
          {leagues.map((league) => (
            <li key={league.id}>
              <div>
                <div className="league-name">{league.name}</div>
                <span className="invite-code-static">Code: {league.invite_code}</span>
              </div>
              <Link to="/leagues">View</Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}