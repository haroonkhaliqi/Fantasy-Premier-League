import { useEffect, useState } from 'react'
import api from '../api'

interface Fixture {
  id: number
  gameweek: number | null
  home_team: string
  away_team: string
  home_badge: number | null
  away_badge: number | null
  home_score: number | null
  away_score: number | null
  kickoff_time: string
  started: boolean
  finished: boolean
}

interface MatchEvent {
  type: string
  player_name: string
  value: number
  side: 'home' | 'away'
}

interface PlayerMatchStats {
  minutes: number
  goals_scored: number
  assists: number
  clean_sheets: number
  goals_conceded: number
  own_goals: number
  penalties_saved: number
  penalties_missed: number
  yellow_cards: number
  red_cards: number
  saves: number
  bonus: number
}

interface FixturePlayer {
  id: number
  name: string
  position: string
  photo_code: string
  points: number
  stats: PlayerMatchStats
}

interface FixtureDetail extends Fixture {
  events: MatchEvent[]
  home_players: FixturePlayer[]
  away_players: FixturePlayer[]
}

export default function MatchesPage() {
  const [fixtures, setFixtures] = useState<Fixture[]>([])
  const [selectedGameweek, setSelectedGameweek] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [detail, setDetail] = useState<FixtureDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  useEffect(() => {
    Promise.all([api.get('/fixtures'), api.get('/gameweeks/current')])
      .then(([fixturesRes, currentRes]) => {
        setFixtures(fixturesRes.data)
        setSelectedGameweek(currentRes.data.current_gameweek)
      })
      .catch(() => setError('Failed to load fixtures'))
      .finally(() => setLoading(false))
  }, [])

  const statusLabel = (fx: Fixture) => {
    if (fx.finished) return 'FT'
    if (fx.started) return 'LIVE'
    return new Date(fx.kickoff_time).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    })
  }

  const badgeUrl = (code: number) =>
    `https://resources.premierleague.com/premierleague/badges/70/t${code}.png`

  const headshotUrl = (photoCode: string) =>
    `https://resources.premierleague.com/premierleague/photos/players/110x140/p${photoCode}.png`

  const statLine = (s: PlayerMatchStats, position: string) => {
    const parts: string[] = [`${s.minutes}'`]
    if (s.goals_scored) parts.push(`${s.goals_scored} Goal${s.goals_scored > 1 ? 's' : ''}`)
    if (s.assists) parts.push(`${s.assists} Assist${s.assists > 1 ? 's' : ''}`)
    if (position === 'GK' || position === 'DEF') {
      if (s.clean_sheets) parts.push('Clean Sheet')
      if (s.goals_conceded) parts.push(`${s.goals_conceded} Conceded`)
    }
    if (position === 'GK' && s.saves) parts.push(`${s.saves} Save${s.saves > 1 ? 's' : ''}`)
    if (s.penalties_saved) parts.push(`${s.penalties_saved} Pen Saved`)
    if (s.penalties_missed) parts.push(`${s.penalties_missed} Pen Missed`)
    if (s.own_goals) parts.push(`${s.own_goals} Own Goal${s.own_goals > 1 ? 's' : ''}`)
    if (s.yellow_cards) parts.push('Yellow Card')
    if (s.red_cards) parts.push('Red Card')
    if (s.bonus) parts.push(`+${s.bonus} Bonus`)
    return parts.join(' · ')
  }

  const openFixture = async (fixtureId: number) => {
    setDetail(null)
    setDetailLoading(true)
    try {
      const res = await api.get(`/fixtures/${fixtureId}`)
      setDetail(res.data)
    } catch {
      setError('Failed to load match details')
    } finally {
      setDetailLoading(false)
    }
  }

  const byGameweek: Record<number, Fixture[]> = {}
  fixtures.forEach((fx) => {
    const gw = fx.gameweek || 0
    if (!byGameweek[gw]) byGameweek[gw] = []
    byGameweek[gw].push(fx)
  })

  const gameweeks = Object.keys(byGameweek)
    .map(Number)
    .sort((a, b) => a - b)

  const activeGameweek = selectedGameweek ?? gameweeks[0]
  const activeFixtures = byGameweek[activeGameweek] || []

  return (
    <div className="page">
      <h1>Matches</h1>
      <p className="subtitle-text">Premier League fixtures and results.</p>

      {loading && <p className="hint">Loading fixtures...</p>}
      {error && <p className="error">{error}</p>}

      {!loading && gameweeks.length > 0 && (
        <>
          <select
            className="sort-select gameweek-select"
            value={activeGameweek}
            onChange={(e) => setSelectedGameweek(Number(e.target.value))}
          >
            {gameweeks.map((gw) => (
              <option key={gw} value={gw}>
                Gameweek {gw}
              </option>
            ))}
          </select>

          <div className="gameweek-block">
            <div className="fixture-list">
              {activeFixtures.map((fx) => (
                <button
                  className={`fixture-row fixture-row-clickable ${fx.started && !fx.finished ? 'live' : ''}`}
                  key={fx.id}
                  onClick={() => openFixture(fx.id)}
                >
                  <span className="fixture-team home">
                    {fx.home_team}
                    {fx.home_badge && (
                      <img className="team-badge" src={badgeUrl(fx.home_badge)} alt="" onError={(e) => (e.currentTarget.style.display = 'none')} />
                    )}
                  </span>
                  <span className="fixture-score">
                    {fx.home_score !== null && fx.away_score !== null
                      ? `${fx.home_score} - ${fx.away_score}`
                      : 'vs'}
                  </span>
                  <span className="fixture-team away">
                    {fx.away_badge && (
                      <img className="team-badge" src={badgeUrl(fx.away_badge)} alt="" onError={(e) => (e.currentTarget.style.display = 'none')} />
                    )}
                    {fx.away_team}
                  </span>
                  <span className={`fixture-status ${fx.started && !fx.finished ? 'live' : ''}`}>
                    {statusLabel(fx)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {(detailLoading || detail) && (
        <div className="modal-overlay" onClick={() => setDetail(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setDetail(null)}>
              ×
            </button>
            {detailLoading && <p className="hint">Loading match details...</p>}
            {detail && (
              <>
                <div className="modal-header">
                  <span className="modal-team">
                    {detail.home_badge && <img className="team-badge-lg" src={badgeUrl(detail.home_badge)} alt="" />}
                    {detail.home_team}
                  </span>
                  <span className="modal-score">
                    {detail.home_score !== null && detail.away_score !== null
                      ? `${detail.home_score} - ${detail.away_score}`
                      : 'vs'}
                  </span>
                  <span className="modal-team">
                    {detail.away_team}
                    {detail.away_badge && <img className="team-badge-lg" src={badgeUrl(detail.away_badge)} alt="" />}
                  </span>
                </div>

                {detail.home_players.length === 0 && detail.away_players.length === 0 ? (
                  <p className="hint">No player stats yet.</p>
                ) : (
                  <div className="lineup-columns">
                    <div className="lineup-column">
                      {detail.home_players.map((p) => (
                        <div className="lineup-player" key={p.id}>
                          <img
                            className="lineup-player-photo"
                            src={headshotUrl(p.photo_code)}
                            alt=""
                            onError={(e) => (e.currentTarget.style.visibility = 'hidden')}
                          />
                          <div className="lineup-player-info">
                            <div className="lineup-player-name-row">
                              <span className="lineup-player-name">{p.name}</span>
                              <span className="lineup-player-points">{p.points} pts</span>
                            </div>
                            <div className="lineup-player-stats">{statLine(p.stats, p.position)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="lineup-column">
                      {detail.away_players.map((p) => (
                        <div className="lineup-player" key={p.id}>
                          <img
                            className="lineup-player-photo"
                            src={headshotUrl(p.photo_code)}
                            alt=""
                            onError={(e) => (e.currentTarget.style.visibility = 'hidden')}
                          />
                          <div className="lineup-player-info">
                            <div className="lineup-player-name-row">
                              <span className="lineup-player-name">{p.name}</span>
                              <span className="lineup-player-points">{p.points} pts</span>
                            </div>
                            <div className="lineup-player-stats">{statLine(p.stats, p.position)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}