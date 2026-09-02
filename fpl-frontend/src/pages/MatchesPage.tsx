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

interface FixtureDetail extends Fixture {
  events: MatchEvent[]
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

                {detail.events.length === 0 ? (
                  <p className="hint">No match events yet.</p>
                ) : (
                  <div className="event-list">
                    {detail.events.map((ev, i) => (
                      <div key={i} className={`event-row ${ev.side}`}>
                        <span className="event-type">{ev.type}</span>
                        <span className="event-player">
                          {ev.player_name}
                          {ev.value > 1 ? ` x${ev.value}` : ''}
                        </span>
                      </div>
                    ))}
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