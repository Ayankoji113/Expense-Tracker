import GoogleIcon from '@mui/icons-material/Google'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useCallback, useEffect, useState } from 'react'
import client, { errorMessage } from '../api/client'
import { useAuth } from '../auth/AuthContext.jsx'
import { useFeedback } from '../components/common/Feedback.jsx'
import { ErrorState, SectionCard, TableSkeleton } from '../components/common/States.jsx'
import { formatLongDate } from '../utils/format'

const USERNAME_PATTERN = /^[a-zA-Z0-9._]{3,30}$/

export default function Profile() {
  const { notify } = useFeedback()
  const { setUser } = useAuth()
  const [profile, setProfile] = useState(null)
  const [form, setForm] = useState({ username: '', age: '' })
  const [fieldErrors, setFieldErrors] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saveError, setSaveError] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    setError('')
    client
      .get('/profile')
      .then(({ data }) => {
        setProfile(data)
        setForm({ username: data.username, age: data.age ?? '' })
      })
      .catch((e) => setError(errorMessage(e, 'Could not load your profile')))
      .finally(() => setLoading(false))
  }, [])

  useEffect(load, [load])

  const submit = async (event) => {
    event.preventDefault()
    const errors = {}
    if (!USERNAME_PATTERN.test(form.username)) {
      errors.username = '3-30 characters: letters, digits, dot or underscore'
    }
    if (form.age && (Number(form.age) < 13 || Number(form.age) > 120)) {
      errors.age = 'Enter an age between 13 and 120'
    }
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    setBusy(true)
    setSaveError('')
    try {
      const { data } = await client.put('/profile', {
        username: form.username.trim().toLowerCase(),
        age: form.age ? Number(form.age) : null,
      })
      setProfile(data)
      setUser(data)
      notify('Profile updated')
    } catch (e) {
      setSaveError(errorMessage(e, 'Could not save your profile'))
    } finally {
      setBusy(false)
    }
  }

  if (error && !loading) {
    return (
      <Paper variant="outlined" sx={{ borderRadius: 4 }}>
        <ErrorState message={error} onRetry={load} />
      </Paper>
    )
  }

  const dirty =
    profile && (form.username !== profile.username || String(form.age ?? '') !== String(profile.age ?? ''))

  return (
    <Stack spacing={2}>
      <Box>
        <Typography variant="h5">Profile</Typography>
        <Typography variant="body2" color="text.secondary">
          Your account details and how you appear in the app.
        </Typography>
      </Box>

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '2fr 3fr' } }}>
        <Paper variant="outlined" sx={{ borderRadius: 4, p: 3 }}>
          {loading ? (
            <TableSkeleton rows={3} />
          ) : (
            <Stack spacing={2} alignItems="center" textAlign="center">
              <Avatar
                src={profile.avatarUrl || undefined}
                sx={{ width: 84, height: 84, bgcolor: 'secondary.main', fontSize: 32 }}
              >
                {profile.username.slice(0, 1).toUpperCase()}
              </Avatar>
              <Box>
                <Typography variant="h6">@{profile.username}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {profile.email}
                </Typography>
              </Box>
              <Chip
                size="small"
                icon={profile.provider === 'GOOGLE' ? <GoogleIcon /> : <LockOutlinedIcon />}
                label={profile.provider === 'GOOGLE' ? 'Google account' : 'Email and password'}
                variant="outlined"
              />
              <Typography variant="caption" color="text.secondary">
                Member since {formatLongDate(profile.createdAt?.slice(0, 10))}
              </Typography>
            </Stack>
          )}
        </Paper>

        <SectionCard title="Edit details" subtitle="Your username is how the app greets you">
          {loading ? (
            <TableSkeleton rows={3} />
          ) : (
            <Stack component="form" spacing={2.5} onSubmit={submit} noValidate>
              {saveError && <Alert severity="error">{saveError}</Alert>}
              <TextField
                label="Username"
                required
                value={form.username}
                onChange={(event) => setForm({ ...form, username: event.target.value })}
                error={Boolean(fieldErrors.username)}
                helperText={fieldErrors.username}
                slotProps={{ input: { startAdornment: <InputAdornment position="start">@</InputAdornment> } }}
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
              <TextField label="Email" value={profile.email} disabled helperText="Email cannot be changed here" />
              <Box>
                <Button type="submit" variant="contained" disabled={busy || !dirty}>
                  {busy ? 'Saving...' : 'Save changes'}
                </Button>
              </Box>
            </Stack>
          )}
        </SectionCard>
      </Box>
    </Stack>
  )
}
