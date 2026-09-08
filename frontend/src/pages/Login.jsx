import { Alert, Box, Button, Link as MuiLink, Stack, TextField } from '@mui/material'
import { useCallback, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { errorMessage } from '../api/client'
import { useAuth } from '../auth/AuthContext.jsx'
import GoogleSignInButton from '../components/auth/GoogleSignInButton.jsx'
import AuthLayout from '../components/layout/AuthLayout.jsx'

export default function Login() {
  const { token, login, loginWithGoogle } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState({ identifier: '', password: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  // carried over from a finished password reset
  const [notice, setNotice] = useState(location.state?.message || '')

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
    setNotice('')
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
        {notice && <Alert severity="success">{notice}</Alert>}
        <Stack component="form" spacing={2.5} onSubmit={submit}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            label="Username or email"
            required
            autoComplete="username"
            value={form.identifier}
            onChange={(event) => setForm({ ...form, identifier: event.target.value })}
          />
          <TextField
            label="Password"
            type="password"
            required
            autoComplete="current-password"
            value={form.password}
            onChange={(event) => setForm({ ...form, password: event.target.value })}
          />
          <Box sx={{ textAlign: 'right', mt: -1 }}>
            <MuiLink component={Link} to="/forgot-password" underline="hover" variant="body2">
              Forgot password?
            </MuiLink>
          </Box>
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
