import { Alert, Button, Link as MuiLink, Stack, TextField, Typography } from '@mui/material'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import client, { errorMessage } from '../api/client'
import AuthLayout from '../components/layout/AuthLayout.jsx'
import { mono } from '../theme'

export default function ForgotPassword() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [form, setForm] = useState({ email: '', code: '', password: '' })
  const [notice, setNotice] = useState(null)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [busy, setBusy] = useState(false)

  const requestCode = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const { data } = await client.post('/auth/password/forgot', { email: form.email.trim() })
      setNotice({
        message: data.message,
        // a self-hosted demo often has no SMTP: say so rather than leaving people waiting
        severity: data.emailConfigured ? 'success' : 'info',
        hint: data.emailConfigured ? null : 'This server has no email configured, so the code was written to the server log.',
      })
      setStep(1)
    } catch (e) {
      setError(errorMessage(e, 'Could not start the reset'))
    } finally {
      setBusy(false)
    }
  }

  const resetPassword = async (event) => {
    event.preventDefault()
    const errors = {}
    if (!/^[0-9]{6}$/.test(form.code.trim())) errors.code = 'Enter the 6-digit code'
    if (form.password.length < 8) errors.password = 'At least 8 characters'
    else if (form.password.length > 72) errors.password = 'At most 72 characters'
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    setBusy(true)
    setError('')
    try {
      await client.post('/auth/password/reset', {
        email: form.email.trim(),
        code: form.code.trim(),
        password: form.password,
      })
      navigate('/login', { state: { message: 'Password changed. Sign in with your new password.' } })
    } catch (e) {
      setError(errorMessage(e, 'Could not reset your password'))
    } finally {
      setBusy(false)
    }
  }

  const startOver = () => {
    setStep(0)
    setError('')
    setFieldErrors({})
    setForm({ ...form, code: '', password: '' })
  }

  return (
    <AuthLayout
      title="Reset your password"
      subtitle={
        step === 0
          ? 'We will email you a 6-digit code, then you can choose a new password.'
          : `Enter the code sent to ${form.email.trim()} and choose a new password.`
      }
    >
      <Stack spacing={3}>
        <Typography variant="overline" color="text.secondary" aria-live="polite">
          Step {step + 1} of 2
        </Typography>

        {error && <Alert severity="error">{error}</Alert>}

        {step === 0 ? (
          <Stack component="form" spacing={2.5} onSubmit={requestCode}>
            <TextField
              label="Email"
              type="email"
              required
              autoFocus
              autoComplete="email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              helperText="The address you signed up with"
            />
            <Button type="submit" variant="contained" size="large" disabled={busy}>
              {busy ? 'Sending...' : 'Send code'}
            </Button>
          </Stack>
        ) : (
          <Stack component="form" spacing={2.5} onSubmit={resetPassword} noValidate>
            {notice && (
              <Alert severity={notice.severity}>
                {notice.message}
                {notice.hint && (
                  <Typography variant="caption" color="inherit" sx={{ display: 'block', mt: 0.5 }}>
                    {notice.hint}
                  </Typography>
                )}
              </Alert>
            )}
            <TextField
              label="6-digit code"
              required
              autoFocus
              autoComplete="one-time-code"
              value={form.code}
              onChange={(event) => setForm({ ...form, code: event.target.value.replace(/\D/g, '').slice(0, 6) })}
              error={Boolean(fieldErrors.code)}
              helperText={fieldErrors.code || 'Expires 15 minutes after it was sent'}
              slotProps={{
                htmlInput: { inputMode: 'numeric', maxLength: 6, style: { ...mono, letterSpacing: '0.4em' } },
              }}
            />
            <TextField
              label="New password"
              type="password"
              required
              autoComplete="new-password"
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              error={Boolean(fieldErrors.password)}
              helperText={fieldErrors.password || 'At least 8 characters'}
            />
            <Button type="submit" variant="contained" size="large" disabled={busy}>
              {busy ? 'Saving...' : 'Set new password'}
            </Button>
            <Button onClick={startOver} disabled={busy} color="inherit">
              Use a different email
            </Button>
          </Stack>
        )}

        <Typography variant="body2">
          <MuiLink component={Link} to="/login">
            Back to sign in
          </MuiLink>
        </Typography>
      </Stack>
    </AuthLayout>
  )
}
