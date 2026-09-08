import DarkModeIcon from '@mui/icons-material/DarkMode'
import LightModeIcon from '@mui/icons-material/LightMode'
import LogoutIcon from '@mui/icons-material/Logout'
import {
  AppBar,
  Box,
  Button,
  CssBaseline,
  IconButton,
  Toolbar,
  Typography,
} from '@mui/material'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import { useMemo, useState } from 'react'
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { RequireAuth, useAuth } from './auth/AuthContext.jsx'
import Categories from './pages/Categories.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Expenses from './pages/Expenses.jsx'
import Import from './pages/Import.jsx'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'

const NAV = [
  { to: '/', label: 'Dashboard' },
  { to: '/expenses', label: 'Expenses' },
  { to: '/import', label: 'Import' },
  { to: '/categories', label: 'Categories' },
]

const MODE_KEY = 'expense-tracker-mode'

export default function App() {
  const [mode, setMode] = useState(() => localStorage.getItem(MODE_KEY) || 'light')
  const theme = useMemo(
    () => createTheme({ palette: { mode, primary: { main: '#1565c0' } }, shape: { borderRadius: 10 } }),
    [mode],
  )
  const toggleMode = () => {
    const next = mode === 'light' ? 'dark' : 'light'
    localStorage.setItem(MODE_KEY, next)
    setMode(next)
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <NavBar mode={mode} onToggleMode={toggleMode} />
      <Box component="main" sx={{ p: { xs: 2, md: 3 }, maxWidth: 1200, mx: 'auto' }}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/" element={<RequireAuth><Dashboard /></RequireAuth>} />
          <Route path="/expenses" element={<RequireAuth><Expenses /></RequireAuth>} />
          <Route path="/import" element={<RequireAuth><Import /></RequireAuth>} />
          <Route path="/categories" element={<RequireAuth><Categories /></RequireAuth>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Box>
    </ThemeProvider>
  )
}

function NavBar({ mode, onToggleMode }) {
  const { token, email, logout } = useAuth()
  const { pathname } = useLocation()

  return (
    <AppBar position="static" elevation={0} color="primary">
      <Toolbar sx={{ gap: 1, flexWrap: 'wrap' }}>
        <Typography variant="h6" sx={{ mr: 2, fontWeight: 700 }}>
          Expense Tracker
        </Typography>
        {token &&
          NAV.map((item) => (
            <Button
              key={item.to}
              component={Link}
              to={item.to}
              color="inherit"
              sx={{ fontWeight: pathname === item.to ? 700 : 400 }}
            >
              {item.label}
            </Button>
          ))}
        <Box sx={{ flexGrow: 1 }} />
        <IconButton color="inherit" onClick={onToggleMode} aria-label="toggle colour mode">
          {mode === 'light' ? <DarkModeIcon /> : <LightModeIcon />}
        </IconButton>
        {token && (
          <>
            <Typography variant="body2" sx={{ display: { xs: 'none', sm: 'block' } }}>
              {email}
            </Typography>
            <IconButton color="inherit" onClick={logout} aria-label="log out">
              <LogoutIcon />
            </IconButton>
          </>
        )}
      </Toolbar>
    </AppBar>
  )
}
