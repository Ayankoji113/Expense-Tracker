import { CssBaseline } from '@mui/material'
import { ThemeProvider } from '@mui/material/styles'
import { useMemo, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { RequireAuth } from './auth/AuthContext.jsx'
import { FeedbackProvider } from './components/common/Feedback.jsx'
import MainLayout from './components/layout/MainLayout.jsx'
import Analytics from './pages/Analytics.jsx'
import Budgets from './pages/Budgets.jsx'
import Categories from './pages/Categories.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Import from './pages/Import.jsx'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import Transactions from './pages/Transactions.jsx'
import { createAppTheme } from './theme'

const MODE_KEY = 'expense-tracker-mode'

function initialMode() {
  try {
    const stored = localStorage.getItem(MODE_KEY)
    if (stored === 'light' || stored === 'dark') return stored
  } catch {
    // private mode or blocked storage - fall through to the system preference
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export default function App() {
  const [mode, setMode] = useState(initialMode)
  const theme = useMemo(() => createAppTheme(mode), [mode])

  const toggleMode = () => {
    const next = mode === 'light' ? 'dark' : 'light'
    try {
      localStorage.setItem(MODE_KEY, next)
    } catch {
      // preference just will not persist
    }
    setMode(next)
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <FeedbackProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            element={
              <RequireAuth>
                <MainLayout mode={mode} onToggleMode={toggleMode} />
              </RequireAuth>
            }
          >
            <Route path="/" element={<Dashboard />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/budgets" element={<Budgets />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/categories" element={<Categories />} />
            <Route path="/import" element={<Import />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </FeedbackProvider>
    </ThemeProvider>
  )
}
