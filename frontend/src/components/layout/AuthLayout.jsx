import { Box, Stack, Typography } from '@mui/material'
import { mono } from '../../theme'
import Wordmark from './Wordmark.jsx'

// the sign-in panel keeps its own colours in both modes, like a cover
const PANEL = { bg: '#163A2C', ink: '#EFEBDD', dim: 'rgba(239, 235, 221, 0.62)', rule: 'rgba(239, 235, 221, 0.18)' }

// what the product makes, shown instead of described
const LEDGER = [
  ['01', 'Salary, August', '+85,000'],
  ['01', 'Big Bazaar groceries', '−3,240'],
  ['02', 'Uber trip', '−320'],
  ['05', 'Rent', '−25,000'],
  ['07', 'Netflix', '−649'],
  ['09', 'Indian Oil fuel', '−2,200'],
  ['15', 'Electricity bill', '−2,180'],
]

/** Cover panel on desktop, just the form on mobile. */
export default function AuthLayout({ title, subtitle, children }) {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: '1fr 1fr', lg: '11fr 9fr' },
        bgcolor: 'background.default',
      }}
    >
      <Box
        sx={{
          display: { xs: 'none', md: 'flex' },
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: 6,
          p: { md: 5, lg: 7 },
          bgcolor: PANEL.bg,
          color: PANEL.ink,
        }}
      >
        <Wordmark inverted />

        <Box>
          <Typography variant="h3" component="p" sx={{ maxWidth: 440, fontSize: { md: '2.5rem', lg: '3rem' } }}>
            Every rupee,{' '}
            <Box component="em" sx={{ fontStyle: 'italic' }}>
              written down.
            </Box>
          </Typography>
          <Typography sx={{ mt: 2, maxWidth: 420, color: PANEL.dim }}>
            Import a bank statement, let your own rules file each line, and see what the month actually cost.
          </Typography>
        </Box>

        <Box aria-hidden sx={{ maxWidth: 460 }}>
          <Stack
            direction="row"
            sx={{ justifyContent: 'space-between', pb: 1, borderBottom: `1px solid ${PANEL.rule}`, color: PANEL.dim }}
          >
            <Typography variant="overline">August 2026</Typography>
            <Typography variant="overline">₹</Typography>
          </Stack>
          {LEDGER.map(([day, description, amount]) => (
            <Stack
              key={description}
              direction="row"
              spacing={2}
              sx={{ py: 0.875, borderBottom: `1px solid ${PANEL.rule}`, fontSize: '0.8125rem' }}
            >
              <Box component="span" sx={{ ...mono, color: PANEL.dim }}>
                {day}
              </Box>
              <Box component="span" sx={{ flexGrow: 1 }}>
                {description}
              </Box>
              <Box component="span" sx={mono}>
                {amount}
              </Box>
            </Stack>
          ))}
          <Stack direction="row" sx={{ justifyContent: 'space-between', pt: 1.25, fontSize: '0.8125rem' }}>
            <Box component="span" sx={{ color: PANEL.dim }}>
              Kept 60.5% of income
            </Box>
            <Box component="span" sx={{ ...mono, fontWeight: 600 }}>
              +51,411
            </Box>
          </Stack>
        </Box>
      </Box>

      <Box sx={{ display: 'grid', placeItems: 'center', p: { xs: 3, sm: 5 } }}>
        <Box sx={{ width: '100%', maxWidth: 380 }}>
          <Box sx={{ display: { md: 'none' }, mb: 5 }}>
            <Wordmark />
          </Box>
          <Typography variant="h4" component="h1">
            {title}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 4 }}>
            {subtitle}
          </Typography>
          {children}
        </Box>
      </Box>
    </Box>
  )
}
