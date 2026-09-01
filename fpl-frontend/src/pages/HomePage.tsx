import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api'

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
  const [squad, setSquad] = useState<Squad | null>(null)
  const [leagues, setLeagues] = useState<League[]>([])
  const [loading, setLoading] = useState(true)

  const [activeForm, setActiveForm] = useState<'create' | 'join' | null>(null)
  const [leagueName, setLeagueName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [formError, setFormError] = useState('')
  const [formMessage, setFormMessage] = useState('')

  const loadData = async () => {
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
  }, [])

  const startersCount = squad?.squad_players.filter((sp) => sp.is_starting).length || 0
  const squadCount = squad?.squad_players.length || 0

  const openForm = (form: 'create' | 'join') => {
    setActiveForm(activeForm === form ? null : form)
    setFormError('')
    setFormMessage('')
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
        <h1>Welcome back</h1>
        <p className="hero-subtitle">Here's where things stand for Gameweek 1.</p>
      </div>

      <div className="quick-actions">
          <button className="quick-action" onClick={() => openForm('create')}>
          <div className="quick-action-image-wrap">
            <img className="quick-action-image" src="/images/create-league.png" alt="" />
          </div>
          <div className="quick-action-label">
            Create a League
            <span className="quick-action-badge"> +</span>
          </div>
        </button>
        <button className="quick-action" onClick={() => openForm('join')}>
          <div className="quick-action-image-wrap">
            <img className="quick-action-image" src="/images/join-league.png" alt="" />
          </div>
          <div className="quick-action-label">
            Join a League
            <span className="quick-action-badge"> #</span>
          </div>
        </button>
        <Link to="/leaderboard" className="quick-action">
          <div className="quick-action-image-wrap">
            <img className="quick-action-image" src="/images/leaderboard.png" alt="" />
          </div>
          <div className="quick-action-label">
            World Leaderboard
            <span className="quick-action-badge"> 🏆</span>
          </div>
        </Link>
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

      {!loading && (
        <>
          <h2>Your Leagues</h2>
          {leagues.length === 0 ? (
            <p className="hint">You're not in any leagues yet — create or join one above.</p>
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
        </>
      )}
    </div>
  )
}