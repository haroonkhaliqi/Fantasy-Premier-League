import { useEffect, useState } from 'react'
import api from '../api'

interface LeaderboardEntry {
  username: string
  total_points: number
  rank: number
}

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])

  useEffect(() => {
    api.get('/leaderboard/1').then((res) => setEntries(res.data.leaderboard))
  }, [])

  return (
    <div className="page">
      <h1>Leaderboard — Gameweek 1</h1>
      <table className="leaderboard-table">
        <thead>
          <tr>
            <th>Rank</th>
            <th>Username</th>
            <th>Points</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.username}>
              <td>{entry.rank}</td>
              <td>{entry.username}</td>
              <td>{entry.total_points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}