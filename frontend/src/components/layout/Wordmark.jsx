import { Box, Stack, Typography } from '@mui/material'
import { fonts } from '../../theme'

/** The rupee mark and the name. `inverted` is for the dark green sign-in panel. */
export default function Wordmark({ inverted = false }) {
  return (
    <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
      <Box
        aria-hidden
        sx={{
          width: 28,
          height: 28,
          borderRadius: 1,
          display: 'grid',
          placeItems: 'center',
          fontFamily: fonts.body,
          fontWeight: 600,
          fontSize: 17,
          lineHeight: 1,
          bgcolor: inverted ? '#EFEBDD' : 'primary.main',
          color: inverted ? '#163A2C' : 'primary.contrastText',
        }}
      >
        ₹
      </Box>
      <Typography
        component="span"
        noWrap
        sx={{ fontFamily: fonts.display, fontWeight: 500, fontSize: '1.125rem', letterSpacing: '-0.01em' }}
      >
        Expense Tracker
      </Typography>
    </Stack>
  )
}
