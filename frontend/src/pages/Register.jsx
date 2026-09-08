import { Alert, Box, Button, Link as MuiLink, Stack, TextField } from '@mui/material'
import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { errorMessage } from '../api/client'
import { useAuth } from '../auth/AuthContext.jsx'
import AuthLayout from '../components/layout/AuthLayout.jsx'

export default function Register() {
  const { token, register } = useAuth()
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
      await register(form)
      navigate('/')
    } catch (e) {
      setError(errorMessage(e, 'Registration failed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout title="Create your account" subtitle="Track spending, set budgets, import statements.">
      <Stack component="form" spacing={2.5} onSubmit={submit}>
        {error && <Alert severity="error">{error}</Alert>}
        <TextField
          label="Email"
          type="email"
          required
          autoComplete="email"
          value={form.email}
          onChange={(event) => setForm({ ...form, email: event.target.value })}
        />
        <TextField
          label="Password"
          type="password"
          required
          autoComplete="new-password"
          helperText="At least 8 characters"
          slotProps={{ htmlInput: { minLength: 8 } }}
          value={form.password}
          onChange={(event) => setForm({ ...form, password: event.target.value })}
        />
        <Button type="submit" variant="contained" size="large" disabled={busy}>
          {busy ? 'Creating account...' : 'Create account'}
        </Button>
        <Box sx={{ textAlign: 'center' }}>
          <MuiLink component={Link} to="/login" underline="hover">
            Already registered? Sign in
          </MuiLink>
        </Box>
      </Stack>
    </AuthLayout>
  )
}
