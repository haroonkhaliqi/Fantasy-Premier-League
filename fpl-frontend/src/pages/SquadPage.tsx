import { useEffect, useState } from 'react'
import api from '../api'

interface Player {
  id: number
  name: string
  position: string
  price: number
  team_id: number
}

interface SquadPlayer {
  player_id: number
  is_starting: boolean
  is_captain: boolean
}

interface Squad {
  id: number
  budget_remaining: number
  squad_players: SquadPlayer[]
}

export default function SquadPage() {
  const [squad, setSquad] = useState<Squad | null>(null)
  const [allPlayers, setAllPlayers] = useState<Player[]>([])
  const [error, setError] = useState('')

  const loadData = async () => {
    try {
      const squadRes = await api.get('/squad')
      setSquad(squadRes.data)
    } catch {
      // No squad yet - that's fine, user can create one
      setSquad(null)
    }
    const playersRes = await api.get('/players')
    setAllPlayers(playersRes.data)
  }

  useEffect(() => {
    loadData()
  }, [])

  const createSquad = async () => {
    setError('')
    try {
      await api.post('/squad')
      loadData()
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to create squad')
    }
  }

  const addPlayer = async (playerId: number) => {
    setError('')
    try {
      await api.post('/squad/players', { player_id: playerId })
      loadData()
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to add player')
    }
  }

  const playerNameById = (id: number) =>
    allPlayers.find((p) => p.id === id)?.name || `Player ${id}`

  if (!squad) {
    return (
      <div className="page">
        <h1>Build Your Squad</h1>
        <p>You don't have a squad yet.</p>
        <button onClick={createSquad}>Create Squad</button>
        {error && <p className="error">{error}</p>}
      </div>
    )
  }

  const squadPlayerIds = new Set(squad.squad_players.map((sp) => sp.player_id))

  return (
    <div className="page">
      <h1>Your Squad</h1>
      <p className="budget">Budget remaining: £{squad.budget_remaining.toFixed(1)}m</p>
      {error && <p className="error">{error}</p>}

      <h2>Your Players ({squad.squad_players.length}/15)</h2>
      <ul className="player-list">
        {squad.squad_players.map((sp) => (
          <li key={sp.player_id}>
            {playerNameById(sp.player_id)}
            {sp.is_captain && <span className="captain-badge">C</span>}
          </li>
        ))}
      </ul>

      <h2>Available Players</h2>
      <ul className="player-list">
        {allPlayers
          .filter((p) => !squadPlayerIds.has(p.id))
          .slice(0, 30)
          .map((p) => (
            <li key={p.id}>
              {p.name} — {p.position} — £{p.price}m
              <button onClick={() => addPlayer(p.id)}>Add</button>
            </li>
          ))}
      </ul>
    </div>
  )
}