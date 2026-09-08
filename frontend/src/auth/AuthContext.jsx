import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import client, { TOKEN_KEY } from '../api/client'

const USER_KEY = 'expense-tracker-user'
const AuthContext = createContext(null)

function readStoredUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY)) || null
  } catch {
    return null
  }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY))
  const [user, setUser] = useState(readStoredUser)

  const store = useCallback((data) => {
    localStorage.setItem(TOKEN_KEY, data.token)
    localStorage.setItem(USER_KEY, JSON.stringify(data.user))
    setToken(data.token)
    setUser(data.user)
    return data
  }, [])

  const authenticate = useCallback(
    async (path, payload) => store((await client.post(`/auth/${path}`, payload)).data),
    [store],
  )

  const value = useMemo(
    () => ({
      token,
      user,
      email: user?.email,
      login: (credentials) => authenticate('login', credentials),
      register: (details) => authenticate('register', details),
      loginWithGoogle: (credential) => authenticate('google', { credential }),
      // keeps the sidebar and greeting in step after a profile edit
      setUser: (updated) => {
        localStorage.setItem(USER_KEY, JSON.stringify(updated))
        setUser(updated)
      },
      logout: () => {
        localStorage.removeItem(TOKEN_KEY)
        localStorage.removeItem(USER_KEY)
        setToken(null)
        setUser(null)
      },
    }),
    [token, user, authenticate],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}

export function RequireAuth({ children }) {
  const { token } = useAuth()
  const location = useLocation()
  if (!token) return <Navigate to="/login" state={{ from: location }} replace />
  return children
}
