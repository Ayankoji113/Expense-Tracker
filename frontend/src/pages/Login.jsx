import { Alert, Box, Button, Link as MuiLink, Paper, TextField, Typography } from '@mui/material'
import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { errorMessage } from '../api/client'
import { useAuth } from '../auth/AuthContext.jsx'

export default function Login() {
  const { token, login } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (token) return <Navigate to="/" replace />

  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await login(form)
      navigate('/')
    } catch (e) {
      setError(errorMessage(e, 'Login failed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Paper component="form" onSubmit={submit} sx={{ p: 4, maxWidth: 420, mx: 'auto', mt: 6 }}>
      <Typography variant="h5" sx={{ mb: 3, fontWeight: 700 }}>
        Sign in
      </Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <TextField
        label="Email"
        type="email"
        fullWidth
        required
        margin="normal"
        value={form.email}
        onChange={(e) => setForm({ ...form, email: e.target.value })}
      />
      <TextField
        label="Password"
        type="password"
        fullWidth
        required
        margin="normal"
        value={form.password}
        onChange={(e) => setForm({ ...form, password: e.target.value })}
      />
      <Button type="submit" variant="contained" fullWidth size="large" sx={{ mt: 3 }} disabled={busy}>
        {busy ? 'Signing in...' : 'Sign in'}
      </Button>
      <Box sx={{ mt: 2, textAlign: 'center' }}>
        <MuiLink component={Link} to="/register">
          No account? Create one
        </MuiLink>
      </Box>
    </Paper>
  )
}
