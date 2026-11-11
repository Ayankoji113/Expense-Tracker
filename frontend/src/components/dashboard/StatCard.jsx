import { Box, Paper, Skeleton, Typography } from '@mui/material'
import { mono } from '../../theme'

/**
 * A row of headline figures in one ruled panel, like the totals line of a statement. The 1px gap
 * over a divider-coloured background draws the rules between cells at every breakpoint.
 */
export function StatStrip({ children, columns = 4 }) {
  return (
    <Paper
      variant="outlined"
      sx={{
        display: 'grid',
        gap: '1px',
        overflow: 'hidden',
        bgcolor: 'divider',
        gridTemplateColumns: { xs: 'repeat(2, 1fr)', lg: `repeat(${columns}, 1fr)` },
        // an odd one out at the end fills its row rather than leaving a hole
        '& > :last-child:nth-of-type(odd)': { gridColumn: { xs: '1 / -1', lg: 'auto' } },
      }}
    >
      {children}
    </Paper>
  )
}

/**
 * Label, figure, and either a change against the previous period or a caption.
 * `tone` colours the figure only when it carries meaning (a negative balance, say).
 */
export default function StatCard({ label, value, caption, change, invertChange, tone, numeric = true }) {
  const hasChange = change !== null && change !== undefined
  const up = hasChange && Number(change) >= 0
  // spending more is bad news, earning more is good news
  const good = invertChange ? !up : up

  return (
    <Box sx={{ bgcolor: 'background.paper', p: { xs: 2, md: 2.5 }, minWidth: 0 }}>
      <Typography variant="overline" component="p" color="text.secondary" noWrap>
        {label}
      </Typography>
      <Typography
        component="p"
        sx={{
          ...(numeric ? mono : { fontFamily: (theme) => theme.typography.h4.fontFamily }),
          mt: 0.75,
          fontSize: { xs: '1.25rem', sm: '1.5rem', md: '1.75rem' },
          fontWeight: 500,
          lineHeight: 1.2,
          letterSpacing: '-0.03em',
          overflowWrap: 'anywhere',
          color: tone ? `${tone}.main` : 'text.primary',
        }}
      >
        {value}
      </Typography>
      <Typography variant="caption" component="p" sx={{ mt: 0.75, minHeight: 20 }}>
        {hasChange ? (
          <>
            <Box component="span" sx={{ ...mono, fontWeight: 600, color: good ? 'success.main' : 'error.main' }}>
              {up ? '↑' : '↓'} {Math.abs(Number(change)).toFixed(1)}%
            </Box>{' '}
            vs previous period
          </>
        ) : (
          caption
        )}
      </Typography>
    </Box>
  )
}

export function StatStripSkeleton({ count = 4 }) {
  return (
    <StatStrip columns={count}>
      {Array.from({ length: count }, (_, index) => (
        <Box key={index} sx={{ bgcolor: 'background.paper', p: { xs: 2, md: 2.5 } }}>
          <Skeleton width="45%" height={16} />
          <Skeleton width="75%" height={38} sx={{ mt: 0.5 }} />
          <Skeleton width="55%" height={16} />
        </Box>
      ))}
    </StatStrip>
  )
}
