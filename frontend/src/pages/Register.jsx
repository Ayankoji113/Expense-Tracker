import { Alert, Box, Button, InputAdornment, Link as MuiLink, Stack, TextField } from '@mui/material'
import { useCallback, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { errorMessage } from '../api/client'
import { useAuth } from '../auth/AuthContext.jsx'
import GoogleSignInButton from '../components/auth/GoogleSignInButton.jsx'
import AuthLayout from '../components/layout/AuthLayout.jsx'

const USERNAME_PATTERN = /^[a-zA-Z0-9._]{3,30}$/

export default function Register() {
  const { token, register, loginWithGoogle } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', username: '', password: '', age: '' })
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [busy, setBusy] = useState(false)

  const signUpWithGoogle = useCallback(
    async (credential) => {
      setError('')
      try {
        await loginWithGoogle(credential)
        navigate('/')
      } catch (e) {
        setError(errorMessage(e, 'Google sign-up failed'))
      }
    },
    [loginWithGoogle, navigate],
  )

  if (token) return <Navigate to="/" replace />

  const validate = () => {
    const errors = {}
    if (!USERNAME_PATTERN.test(form.username)) {
      errors.username = '3-30 characters: letters, digits, dot or underscore'
    }
    if (form.password.length < 8) errors.password = 'At least 8 characters'
    if (form.age && (Number(form.age) < 13 || Number(form.age) > 120)) {
      errors.age = 'Enter an age between 13 and 120'
    }
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const submit = async (event) => {
    event.preventDefault()
    if (!validate()) return
    setBusy(true)
    setError('')
    try {
      await register({
        email: form.email.trim(),
        username: form.username.trim().toLowerCase(),
        password: form.password,
        age: form.age ? Number(form.age) : null,
      })
      navigate('/')
    } catch (e) {
      setError(errorMessage(e, 'Registration failed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout title="Create your account" subtitle="Track spending, set budgets, import statements.">
      <Stack spacing={2.5}>
        <Stack component="form" spacing={2.5} onSubmit={submit} noValidate>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            label="Username"
            required
            autoComplete="username"
            value={form.username}
            onChange={(event) => setForm({ ...form, username: event.target.value })}
            error={Boolean(fieldErrors.username)}
            helperText={fieldErrors.username || 'Your display name in the app'}
            slotProps={{ input: { startAdornment: <InputAdornment position="start">@</InputAdornment> } }}
          />
          <TextField
            label="Email"
            type="email"
            required
            autoComplete="email"
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
          />
          <TextField
            label="Age"
            type="number"
            value={form.age}
            onChange={(event) => setForm({ ...form, age: event.target.value })}
            error={Boolean(fieldErrors.age)}
            helperText={fieldErrors.age || 'Optional'}
            slotProps={{ htmlInput: { min: 13, max: 120, inputMode: 'numeric' } }}
          />
          <TextField
            label="Password"
            type="password"
            required
            autoComplete="new-password"
            value={form.password}
            onChange={(event) => setForm({ ...form, password: event.target.value })}
            error={Boolean(fieldErrors.password)}
            helperText={fieldErrors.password || 'At least 8 characters'}
          />
          <Button type="submit" variant="contained" size="large" disabled={busy}>
            {busy ? 'Creating account...' : 'Create account'}
          </Button>
        </Stack>

        <GoogleSignInButton onCredential={signUpWithGoogle} onError={setError} />

        <Box sx={{ textAlign: 'center' }}>
          <MuiLink component={Link} to="/login" underline="hover">
            Already registered? Sign in
          </MuiLink>
        </Box>
      </Stack>
    </AuthLayout>
  )
}
