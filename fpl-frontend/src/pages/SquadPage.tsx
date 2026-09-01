import { useEffect, useState } from 'react'
import api from '../api'

interface Player {
  id: number
  name: string
  position: string
  price: number
  team_id: number
  total_points: number
  photo_code: string
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

const STARTING_LIMITS: Record<string, number> = { GK: 1, DEF: 4, MID: 3, FWD: 3 }
const SQUAD_LIMITS: Record<string, number> = { GK: 2, DEF: 5, MID: 5, FWD: 3 }
const BENCH_LIMITS: Record<string, number> = {
  GK: SQUAD_LIMITS.GK - STARTING_LIMITS.GK,
  DEF: SQUAD_LIMITS.DEF - STARTING_LIMITS.DEF,
  MID: SQUAD_LIMITS.MID - STARTING_LIMITS.MID,
  FWD: SQUAD_LIMITS.FWD - STARTING_LIMITS.FWD,
}
const POSITION_LIMITS = STARTING_LIMITS
const POSITION_ORDER = ['GK', 'DEF', 'MID', 'FWD']

export default function SquadPage() {
  const [squad, setSquad] = useState<Squad | null>(null)
  const [allPlayers, setAllPlayers] = useState<Player[]>([])
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [positionFilter, setPositionFilter] = useState('GK')
  const [sortBy, setSortBy] = useState<'name' | 'price'>('price')
  const [captainId, setCaptainId] = useState<number | null>(null)
  const [submitMessage, setSubmitMessage] = useState('')

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

  const removePlayer = async (playerId: number) => {
    setError('')
    try {
      await api.delete(`/squad/players/${playerId}`)
      loadData()
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to remove player')
    }
  }

  const toggleCaptain = (playerId: number) => {
    setCaptainId((prev) => (prev === playerId ? null : playerId))
  }

  const submitSquad = async () => {
    setError('')
    setSubmitMessage('')

    const startingIds: number[] = []
    POSITION_ORDER.forEach((pos) => {
      byPosition[pos].slice(0, STARTING_LIMITS[pos]).forEach((sp) => startingIds.push(sp.player_id))
    })

    if (startingIds.length !== 11) {
      setError(`You need exactly 11 starters filled in (currently ${startingIds.length}).`)
      return
    }
    if (!captainId || !startingIds.includes(captainId)) {
      setError('Pick a captain from your starting XI before submitting.')
      return
    }

    try {
      await api.post('/squad/lineup', { starting_player_ids: startingIds, captain_id: captainId })
      setSubmitMessage('Squad submitted for Gameweek 1!')
      loadData()
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to submit squad')
    }
  }

  const playerById = (id: number) => allPlayers.find((p) => p.id === id)

  const photoUrl = (photoCode: string) =>
    `https://resources.premierleague.com/premierleague/photos/players/110x140/p${photoCode}.png`

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

  const byPosition: Record<string, SquadPlayer[]> = { GK: [], DEF: [], MID: [], FWD: [] }
  squad.squad_players.forEach((sp) => {
    const player = playerById(sp.player_id)
    if (player) byPosition[player.position]?.push(sp)
  })

  const openPickerFor = (position: string) => {
    setPositionFilter(position)
    setSearch('')
    document.getElementById('available-players')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const filteredPlayers = allPlayers
    .filter((p) => !squadPlayerIds.has(p.id))
    .filter((p) => positionFilter === 'ALL' || p.position === positionFilter)
    .filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'price') return b.price - a.price
      return a.name.localeCompare(b.name)
    })
    .slice(0, 50)

  return (
    <div className="page pitch-page">
      <h1>Your Squad</h1>
      <p className="budget">Budget remaining: £{squad.budget_remaining.toFixed(1)}m</p>
      {error && <p className="error">{error}</p>}

      <div className="squad-layout">
        <div className="squad-left">
          {(() => {
              const renderSlots = (pos: string, limit: number, startIndex: number, isStartingRow: boolean) => {
              const filled = byPosition[pos].slice(startIndex, startIndex + limit)
              const slots = Array.from({ length: limit })
              return slots.map((_, i) => {
                const sp = filled[i]
                if (sp) {
                  const player = playerById(sp.player_id)
                  const isCaptain = captainId === sp.player_id
                  return (
                    <div className={`slot filled ${isCaptain ? 'is-captain' : ''}`} key={sp.player_id}>
                      <button
                        className="slot-remove"
                        onClick={() => removePlayer(sp.player_id)}
                        title="Remove player"
                      >
                        ×
                      </button>
                      {player?.photo_code && (
                        <img
                          className="slot-photo"
                          src={photoUrl(player.photo_code)}
                          alt={player.name}
                          onError={(e) => (e.currentTarget.style.display = 'none')}
                        />
                      )}
                      <div className="slot-name">{player?.name}</div>
                      <div className="slot-price">£{player?.price}m</div>
                      {isStartingRow && (
                        <button
                          className="captain-toggle"
                          onClick={() => toggleCaptain(sp.player_id)}
                          title="Set as captain"
                        >
                          {isCaptain ? 'C' : '+C'}
                        </button>
                      )}
                    </div>
                  )
                }
                return (
                  <button
                    className="slot empty"
                    key={`${pos}-empty-${startIndex}-${i}`}
                    onClick={() => openPickerFor(pos)}
                  >
                    <span className="plus">+</span>
                    <span className="slot-position">{pos}</span>
                  </button>
                )
              })
            }

            return (
              <>
            <div className="pitch">
              {POSITION_ORDER.map((pos) => (
                <div className="pitch-row" key={pos}>
                  {renderSlots(pos, STARTING_LIMITS[pos], 0, true)}
                </div>
              ))}
            </div>

            <h2>Bench</h2>
              <div className="pitch bench">
                <div className="pitch-row">
                  {POSITION_ORDER.map((pos) =>
                    renderSlots(pos, BENCH_LIMITS[pos], STARTING_LIMITS[pos], false)
                  )}
                </div>
              </div>

              <button className="submit-squad-button" onClick={submitSquad}>
                Submit Squad
              </button>
              {submitMessage && <p className="success">{submitMessage}</p>}
            </>
            )
          })()}
        </div>

        <div className="squad-right">
          <h2 id="available-players">Available Players</h2>

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
            </div>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} className="sort-select">
              <option value="price">Sort by price</option>
              <option value="name">Sort by name</option>
            </select>
          </div>

          <ul className="player-list">
            {filteredPlayers.map((p) => (
              <li key={p.id}>
                <span>
                  {p.name} — {p.position} — £{p.price}m
                </span>
                <button onClick={() => addPlayer(p.id)}>Add</button>
              </li>
            ))}
          </ul>
          {filteredPlayers.length === 50 && (
            <p className="hint">Showing first 50 matches — narrow your search to see more.</p>
          )}
        </div>
      </div>
    </div>
  )
}