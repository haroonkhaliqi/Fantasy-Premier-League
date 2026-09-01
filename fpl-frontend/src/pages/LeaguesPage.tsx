import { useEffect, useState } from 'react'
import api from '../api'

interface League {
  id: number
  name: string
  invite_code: string
  owner_id: number
}

interface LeagueLeaderboardEntry {
  username: string
  total_points: number
  rank: number
}

export default function LeaguesPage() {
  const [leagues, setLeagues] = useState<League[]>([])
  const [newLeagueName, setNewLeagueName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [selectedLeague, setSelectedLeague] = useState<League | null>(null)
  const [leaderboard, setLeaderboard] = useState<LeagueLeaderboardEntry[]>([])

  const loadLeagues = async () => {
    try {
      const res = await api.get('/leagues/mine')
      setLeagues(res.data)
    } catch {
      setLeagues([])
    }
  }

  useEffect(() => {
    loadLeagues()
  }, [])

  const createLeague = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setMessage('')
    try {
      await api.post('/leagues', { name: newLeagueName })
      setNewLeagueName('')
      setMessage('League created!')
      loadLeagues()
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to create league')
    }
  }

  const joinLeague = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setMessage('')
    try {
      await api.post('/leagues/join', { invite_code: joinCode })
      setJoinCode('')
      setMessage('Joined league!')
      loadLeagues()
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to join league')
    }
  }

  const viewLeaderboard = async (league: League) => {
    setSelectedLeague(league)
    setLeaderboard([])
    try {
      const res = await api.get(`/leagues/${league.id}/leaderboard/1`)
      setLeaderboard(res.data.leaderboard)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load league leaderboard')
    }
  }

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code)
    setMessage(`Copied invite code: ${code}`)
  }

  return (
    <div className="page">
      <h1>Leagues</h1>
      <p className="subtitle-text">Create a private league or join one with a friend's code.</p>

      {error && <p className="error">{error}</p>}
      {message && <p className="success">{message}</p>}

      <div className="league-forms">
        <form onSubmit={createLeague} className="league-form">
          <h2>Create a league</h2>
          <input
            type="text"
            placeholder="League name"
            value={newLeagueName}
            onChange={(e) => setNewLeagueName(e.target.value)}
            required
          />
          <button type="submit">Create</button>
        </form>

        <form onSubmit={joinLeague} className="league-form">
          <h2>Join a league</h2>
          <input
            type="text"
            placeholder="Invite code"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            required
          />
          <button type="submit">Join</button>
        </form>
      </div>

      <h2>Your Leagues</h2>
      {leagues.length === 0 && <p className="hint">You're not in any leagues yet.</p>}
      <ul className="league-list">
        {leagues.map((league) => (
          <li key={league.id}>
            <div>
              <div className="league-name">{league.name}</div>
              <button className="invite-code" onClick={() => copyCode(league.invite_code)}>
                Code: {league.invite_code} (click to copy)
              </button>
            </div>
            <button onClick={() => viewLeaderboard(league)}>View Leaderboard</button>
          </li>
        ))}
      </ul>

      {selectedLeague && (
        <div className="league-leaderboard">
          <h2>{selectedLeague.name} — Gameweek 1</h2>
          <table className="leaderboard-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Username</th>
                <th>Points</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((entry) => (
                <tr key={entry.username}>
                  <td>{entry.rank}</td>
                  <td>{entry.username}</td>
                  <td>{entry.total_points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}