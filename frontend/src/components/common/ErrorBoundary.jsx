import { Button, Container, Stack, Typography } from '@mui/material'
import { Component } from 'react'

/** Last line of defence: a render crash shows something human instead of a blank page. */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { failed: false }
  }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error, info) {
    console.error('Unhandled UI error', error, info)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <Container maxWidth="sm" sx={{ py: 10 }}>
        <Stack spacing={2} alignItems="flex-start">
          <Typography variant="h5">Something went wrong</Typography>
          <Typography variant="body2" color="text.secondary">
            The page failed to load. Reloading usually fixes it - your data is safe.
          </Typography>
          <Button variant="contained" onClick={() => window.location.assign('/')}>
            Reload the app
          </Button>
        </Stack>
      </Container>
    )
  }
}
