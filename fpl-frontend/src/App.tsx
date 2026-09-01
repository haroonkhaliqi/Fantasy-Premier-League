import { useState, useEffect } from 'react'
import './App.css'

function App() {
  const [message, setMessage] = useState('Loading...')

  useEffect(() => {
    fetch('http://localhost:8000/')
      .then((res) => res.json())
      .then((data) => setMessage(data.message))
      .catch(() => setMessage('Failed to connect to backend'))
  }, [])

  return (
    <div>
      <h1>FPL Tracker</h1>
      <p>Backend says: {message}</p>
    </div>
  )
}

export default App