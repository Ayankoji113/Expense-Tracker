import TrendingDownIcon from '@mui/icons-material/TrendingDown'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import { Box, Card, CardContent, Stack, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'

/**
 * Tinted icon chip + large value + optional trend. `tone` picks the semantic colour
 * (income green, expense red, balance blue, analytics purple) and everything else follows.
 */
export default function StatCard({ tone = 'primary', icon: Icon, label, value, caption, change, invertChange }) {
  const trendUp = change !== null && change !== undefined && Number(change) >= 0
  // spending more is bad news, earning more is good news
  const trendGood = invertChange ? !trendUp : trendUp

  return (
    <Card sx={{ height: '100%', '&:hover': { boxShadow: (theme) => theme.shadows[2] } }}>
      <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Box
            aria-hidden
            sx={{
              width: 42,
              height: 42,
              flexShrink: 0,
              borderRadius: 2.5,
              display: 'grid',
              placeItems: 'center',
              color: `${tone}.main`,
              bgcolor: (theme) => alpha(theme.palette[tone].main, theme.palette.mode === 'dark' ? 0.18 : 0.1),
            }}
          >
            <Icon fontSize="small" />
          </Box>
          <Typography variant="body2" color="text.secondary" noWrap>
            {label}
          </Typography>
        </Stack>

        <Typography
          variant="h4"
          sx={{ mt: 1.5, fontSize: { xs: '1.5rem', md: '1.75rem' }, wordBreak: 'break-word' }}
        >
          {value}
        </Typography>

        <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mt: 0.5, minHeight: 22 }}>
          {change !== null && change !== undefined ? (
            <>
              {trendUp ? (
                <TrendingUpIcon fontSize="inherit" color={trendGood ? 'success' : 'error'} />
              ) : (
                <TrendingDownIcon fontSize="inherit" color={trendGood ? 'success' : 'error'} />
              )}
              <Typography variant="caption" color={trendGood ? 'success.main' : 'error.main'} fontWeight={600}>
                {trendUp ? '+' : ''}
                {Number(change).toFixed(1)}%
              </Typography>
              <Typography variant="caption" color="text.secondary">
                vs previous period
              </Typography>
            </>
          ) : (
            <Typography variant="caption" color="text.secondary">
              {caption}
            </Typography>
          )}
        </Stack>
      </CardContent>
    </Card>
  )
}
