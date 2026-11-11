import { Alert, Avatar, Box, Button, InputAdornment, Paper, Stack, TextField, Typography } from '@mui/material'
import { useCallback, useEffect, useState } from 'react'
import client, { errorMessage } from '../api/client'
import { useAuth } from '../auth/AuthContext.jsx'
import { useFeedback } from '../components/common/Feedback.jsx'
import { ErrorState, PageHeader, SectionCard, TableSkeleton } from '../components/common/States.jsx'
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
    if (!USERNAME_PATTERN.test(form.username.trim())) {
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
      setForm({ username: data.username, age: data.age ?? '' })
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
      <Paper variant="outlined">
        <ErrorState message={error} onRetry={load} />
      </Paper>
    )
  }

  const dirty =
    profile && (form.username !== profile.username || String(form.age ?? '') !== String(profile.age ?? ''))

  const facts = profile && [
    ['Email', profile.email],
    ['Signs in with', profile.provider === 'GOOGLE' ? 'Google' : 'Email and password'],
    ['Member since', formatLongDate(profile.createdAt?.slice(0, 10))],
  ]

  return (
    <Stack spacing={3}>
      <PageHeader eyebrow="Account" title="Profile" description="Your account details and how the app addresses you." />

      <Box sx={{ display: 'grid', gap: 3, alignItems: 'start', gridTemplateColumns: { xs: '1fr', md: '2fr 3fr' } }}>
        <SectionCard title="Account" flush>
          {loading ? (
            <TableSkeleton rows={3} />
          ) : (
            <>
              <Stack direction="row" spacing={2} sx={{ alignItems: 'center', p: 2.5 }}>
                <Avatar
                  src={profile.avatarUrl || undefined}
                  variant="rounded"
                  sx={{ width: 56, height: 56, fontSize: 24, bgcolor: 'primary.main', color: 'primary.contrastText' }}
                >
                  {profile.username.slice(0, 1).toUpperCase()}
                </Avatar>
                <Typography variant="h5" component="p" noWrap>
                  @{profile.username}
                </Typography>
              </Stack>
              <Box component="dl" sx={{ m: 0 }}>
                {facts.map(([term, detail]) => (
                  <Stack
                    key={term}
                    direction="row"
                    spacing={2}
                    sx={{ justifyContent: 'space-between', px: 2.5, py: 1.25, borderTop: 1, borderColor: 'divider' }}
                  >
                    <Typography component="dt" variant="body2" color="text.secondary" sx={{ flexShrink: 0 }}>
                      {term}
                    </Typography>
                    <Typography component="dd" variant="body2" noWrap sx={{ m: 0 }} title={detail}>
                      {detail}
                    </Typography>
                  </Stack>
                ))}
              </Box>
            </>
          )}
        </SectionCard>

        <SectionCard title="Edit details">
          {loading ? (
            <TableSkeleton rows={3} />
          ) : (
            <Stack component="form" spacing={2.5} onSubmit={submit} noValidate sx={{ maxWidth: 420 }}>
              {saveError && <Alert severity="error">{saveError}</Alert>}
              <TextField
                label="Username"
                required
                value={form.username}
                onChange={(event) => setForm({ ...form, username: event.target.value })}
                error={Boolean(fieldErrors.username)}
                helperText={fieldErrors.username || 'How the app greets you, and what you can sign in with'}
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
