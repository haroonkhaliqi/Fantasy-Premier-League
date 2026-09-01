import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../AuthContext'

export default function LoginPage() {
  const [isSignup, setIsSignup] = useState(false)
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const { login, signup } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      if (isSignup) {
        await signup(email, username, password)
      } else {
        await login(email, password)
      }
      navigate('/home')
    } catch (err) {
      setError('Something went wrong. Check your details and try again.')
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Fantasy Tracker</h1>
        <p className="subtitle">{isSignup ? 'Create your account' : 'Log in to your account'}</p>

        <form onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          {isSignup && (
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          )}
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <p className="error">{error}</p>}
          <button type="submit">{isSignup ? 'Sign up' : 'Log in'}</button>
        </form>

        <button className="link-button" onClick={() => setIsSignup(!isSignup)}>
          {isSignup ? 'Already have an account? Log in' : "Don't have an account? Sign up"}
        </button>
      </div>
    </div>
  )
}