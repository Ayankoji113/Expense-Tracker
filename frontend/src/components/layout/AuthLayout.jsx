import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import InsightsIcon from '@mui/icons-material/Insights'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import WalletIcon from '@mui/icons-material/AccountBalanceWallet'
import { Box, Paper, Stack, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'

const HIGHLIGHTS = [
  { icon: UploadFileIcon, title: 'Import your bank CSV', body: 'Bad rows are reported, duplicates skipped.' },
  { icon: AutoAwesomeIcon, title: 'Auto-categorization', body: 'Keyword rules file each transaction for you.' },
  { icon: InsightsIcon, title: 'See where it goes', body: 'Budgets, trends and category breakdowns.' },
]

/** Brand panel on desktop, just the form on mobile. */
export default function AuthLayout({ title, subtitle, children }) {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: '1fr 1fr', lg: '5fr 4fr' },
        bgcolor: 'background.default',
      }}
    >
      <Box
        sx={{
          display: { xs: 'none', md: 'flex' },
          flexDirection: 'column',
          justifyContent: 'center',
          gap: 4,
          p: 6,
          color: 'common.white',
          background: (theme) =>
            `linear-gradient(140deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
        }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: 2,
              display: 'grid',
              placeItems: 'center',
              bgcolor: alpha('#FFFFFF', 0.2),
            }}
          >
            <WalletIcon />
          </Box>
          <Typography variant="h6">Expense Tracker</Typography>
        </Stack>

        <Box>
          <Typography variant="h4" sx={{ maxWidth: 420 }}>
            Know exactly where your money goes.
          </Typography>
          <Typography sx={{ mt: 1.5, maxWidth: 420, opacity: 0.85 }}>
            Import statements, set budgets, and watch the trends - all in one place.
          </Typography>
        </Box>

        <Stack spacing={2}>
          {HIGHLIGHTS.map(({ icon: Icon, title: heading, body }) => (
            <Stack key={heading} direction="row" spacing={2} alignItems="flex-start">
              <Box
                aria-hidden
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: 2,
                  display: 'grid',
                  placeItems: 'center',
                  bgcolor: alpha('#FFFFFF', 0.18),
                  flexShrink: 0,
                }}
              >
                <Icon fontSize="small" />
              </Box>
              <Box>
                <Typography variant="subtitle2">{heading}</Typography>
                <Typography variant="body2" sx={{ opacity: 0.8 }}>
                  {body}
                </Typography>
              </Box>
            </Stack>
          ))}
        </Stack>
      </Box>

      <Box sx={{ display: 'grid', placeItems: 'center', p: { xs: 2, sm: 4 } }}>
        <Paper
          variant="outlined"
          sx={{ p: { xs: 3, sm: 4 }, borderRadius: 4, width: '100%', maxWidth: 420 }}
        >
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 3, display: { md: 'none' } }}>
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: 2,
                display: 'grid',
                placeItems: 'center',
                color: 'primary.contrastText',
                bgcolor: 'primary.main',
              }}
            >
              <WalletIcon fontSize="small" />
            </Box>
            <Typography variant="subtitle1">Expense Tracker</Typography>
          </Stack>

          <Typography variant="h5">{title}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 3 }}>
            {subtitle}
          </Typography>
          {children}
        </Paper>
      </Box>
    </Box>
  )
}
