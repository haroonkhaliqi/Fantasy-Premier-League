import { createContext, useContext, useState, type ReactNode } from 'react'
import api from './api'

interface AuthContextType {
  isLoggedIn: boolean
  login: (email: string, password: string) => Promise<void>
  signup: (email: string, username: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem('token'))

  const login = async (email: string, password: string) => {
    const res = await api.post('/login', { email, password })
    localStorage.setItem('token', res.data.access_token)
    setIsLoggedIn(true)
  }

  const signup = async (email: string, username: string, password: string) => {
    await api.post('/signup', { email, username, password })
    await login(email, password)
  }

  const logout = () => {
    localStorage.removeItem('token')
    setIsLoggedIn(false)
  }

  return (
    <AuthContext.Provider value={{ isLoggedIn, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}