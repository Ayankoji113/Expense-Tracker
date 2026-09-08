import { Box, Divider, Skeleton, Typography } from '@mui/material'
import { useEffect, useRef, useState } from 'react'
import { useTheme } from '@mui/material/styles'
import client from '../../api/client'

const GSI_SRC = 'https://accounts.google.com/gsi/client'
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID

/** Loads Google's script once, however many buttons ask for it. */
function loadGoogleScript() {
  if (window.google?.accounts?.id) return Promise.resolve()
  const existing = document.querySelector(`script[src="${GSI_SRC}"]`)
  if (existing) return new Promise((resolve, reject) => {
    existing.addEventListener('load', resolve)
    existing.addEventListener('error', reject)
  })
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = GSI_SRC
    script.async = true
    script.defer = true
    script.onload = resolve
    script.onerror = () => reject(new Error('Could not load Google sign-in'))
    document.head.appendChild(script)
  })
}

/**
 * Renders Google's own button. It hands us an ID token which the backend verifies - the browser
 * never sees a client secret, and nothing renders unless both ends are configured.
 */
export default function GoogleSignInButton({ onCredential, onError }) {
  const theme = useTheme()
  const container = useRef(null)
  const [enabled, setEnabled] = useState(null)

  useEffect(() => {
    let cancelled = false
    if (!CLIENT_ID) {
      setEnabled(false)
      return undefined
    }
    // the server decides too: it is the side that can actually verify the token
    client
      .get('/auth/config')
      .then(({ data }) => {
        if (!cancelled) setEnabled(Boolean(data.googleEnabled))
      })
      .catch(() => {
        if (!cancelled) setEnabled(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!enabled || !container.current) return
    let cancelled = false
    loadGoogleScript()
      .then(() => {
        if (cancelled || !container.current) return
        window.google.accounts.id.initialize({
          client_id: CLIENT_ID,
          callback: (response) => onCredential(response.credential),
        })
        window.google.accounts.id.renderButton(container.current, {
          theme: theme.palette.mode === 'dark' ? 'filled_black' : 'outline',
          size: 'large',
          width: 340,
          text: 'continue_with',
          shape: 'pill',
        })
      })
      .catch((error) => onError?.(error.message))
    return () => {
      cancelled = true
    }
  }, [enabled, theme.palette.mode, onCredential, onError])

  if (enabled === false) return null
  if (enabled === null) return <Skeleton variant="rounded" height={44} sx={{ borderRadius: 999 }} />

  return (
    <Box>
      <Divider sx={{ mb: 2 }}>
        <Typography variant="caption" color="text.secondary">
          or
        </Typography>
      </Divider>
      <Box ref={container} sx={{ display: 'flex', justifyContent: 'center', minHeight: 44 }} />
    </Box>
  )
}
