import { Alert, Box, Button, Link as MuiLink, Stack, TextField } from '@mui/material'
import { useCallback, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { errorMessage } from '../api/client'
import { useAuth } from '../auth/AuthContext.jsx'
import GoogleSignInButton from '../components/auth/GoogleSignInButton.jsx'
import AuthLayout from '../components/layout/AuthLayout.jsx'

export default function Login() {
  const { token, login, loginWithGoogle } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const signInWithGoogle = useCallback(
    async (credential) => {
      setError('')
      try {
        await loginWithGoogle(credential)
        navigate('/')
      } catch (e) {
        setError(errorMessage(e, 'Google sign-in failed'))
      }
    },
    [loginWithGoogle, navigate],
  )

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
    <AuthLayout title="Sign in" subtitle="Welcome back. Pick up where you left off.">
      <Stack spacing={2.5}>
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
            autoComplete="current-password"
            value={form.password}
            onChange={(event) => setForm({ ...form, password: event.target.value })}
          />
          <Button type="submit" variant="contained" size="large" disabled={busy}>
            {busy ? 'Signing in...' : 'Sign in'}
          </Button>
        </Stack>

        <GoogleSignInButton onCredential={signInWithGoogle} onError={setError} />

        <Box sx={{ textAlign: 'center' }}>
          <MuiLink component={Link} to="/register" underline="hover">
            No account? Create one
          </MuiLink>
        </Box>
      </Stack>
    </AuthLayout>
  )
}
