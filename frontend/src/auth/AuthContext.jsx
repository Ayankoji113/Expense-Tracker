import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import client, { TOKEN_KEY } from '../api/client'

const EMAIL_KEY = 'expense-tracker-email'
const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY))
  const [email, setEmail] = useState(() => localStorage.getItem(EMAIL_KEY))

  const authenticate = useCallback(async (path, credentials) => {
    const { data } = await client.post(`/auth/${path}`, credentials)
    localStorage.setItem(TOKEN_KEY, data.token)
    localStorage.setItem(EMAIL_KEY, data.email)
    setToken(data.token)
    setEmail(data.email)
    return data
  }, [])

  const value = useMemo(
    () => ({
      token,
      email,
      login: (credentials) => authenticate('login', credentials),
      register: (credentials) => authenticate('register', credentials),
      logout: () => {
        localStorage.removeItem(TOKEN_KEY)
        localStorage.removeItem(EMAIL_KEY)
        setToken(null)
        setEmail(null)
      },
    }),
    [token, email, authenticate],
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
