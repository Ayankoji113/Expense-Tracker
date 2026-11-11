import { Alert, Button, Link as MuiLink, Stack, TextField, Typography } from '@mui/material'
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
  // go back to the page that sent an expired session here
  const destination = location.state?.from?.pathname || '/'

  const signInWithGoogle = useCallback(
    async (credential) => {
      setError('')
      try {
        await loginWithGoogle(credential)
        navigate(destination, { replace: true })
      } catch (e) {
        setError(errorMessage(e, 'Google sign-in failed'))
      }
    },
    [loginWithGoogle, navigate, destination],
  )

  if (token) return <Navigate to={destination} replace />

  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await login(form)
      navigate(destination, { replace: true })
    } catch (e) {
      setError(errorMessage(e, 'Login failed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout title="Sign in" subtitle="Welcome back. Your ledger is where you left it.">
      <Stack spacing={3}>
        {notice && <Alert severity="success">{notice}</Alert>}
        <Stack component="form" spacing={2.5} onSubmit={submit}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            label="Username or email"
            required
            autoFocus
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
          <Button type="submit" variant="contained" size="large" disabled={busy}>
            {busy ? 'Signing in...' : 'Sign in'}
          </Button>
        </Stack>

        <GoogleSignInButton onCredential={signInWithGoogle} onError={setError} />

        <Stack direction="row" sx={{ flexWrap: 'wrap', justifyContent: 'space-between', gap: 1 }}>
          <Typography variant="body2">
            <MuiLink component={Link} to="/register">
              Create an account
            </MuiLink>
          </Typography>
          <Typography variant="body2">
            <MuiLink component={Link} to="/forgot-password" color="text.secondary">
              Forgot password?
            </MuiLink>
          </Typography>
        </Stack>
      </Stack>
    </AuthLayout>
  )
}
