import { useEffect, useState } from 'react'
import api from '../api'

interface Player {
  id: number
  name: string
  position: string
  price: number
  team_id: number
  total_points: number
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
  const [search, setSearch] = useState('')
  const [positionFilter, setPositionFilter] = useState('ALL')
  const [sortBy, setSortBy] = useState<'name' | 'price' | 'points'>('points')

  const loadData = async () => {
    try {
      const squadRes = await api.get('/squad')
      setSquad(squadRes.data)
    } catch {
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

  const filteredPlayers = allPlayers
    .filter((p) => !squadPlayerIds.has(p.id))
    .filter((p) => positionFilter === 'ALL' || p.position === positionFilter)
    .filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'price') return b.price - a.price
      if (sortBy === 'points') return b.total_points - a.total_points
      return a.name.localeCompare(b.name)
    })
    .slice(0, 50)

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

      <div className="filters">
        <input
          type="text"
          placeholder="Search by name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="position-tabs">
          {['ALL', 'GK', 'DEF', 'MID', 'FWD'].map((pos) => (
            <button
              key={pos}
              className={positionFilter === pos ? 'active' : ''}
              onClick={() => setPositionFilter(pos)}
            >
              {pos}
            </button>
          ))}
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} className="sort-select">
          <option value="points">Best players first</option>
          <option value="price">Most expensive first</option>
          <option value="name">Name (A-Z)</option>
        </select>
        </div>
      </div>

      <ul className="player-list">
        {filteredPlayers.map((p) => (
          <li key={p.id}>
            {p.name} — {p.position} — £{p.price}m
            <button onClick={() => addPlayer(p.id)}>Add</button>
          </li>
        ))}
      </ul>
      {filteredPlayers.length === 50 && (
        <p className="hint">Showing first 50 matches — narrow your search to see more.</p>
      )}
    </div>
  )
}