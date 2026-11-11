import RefreshIcon from '@mui/icons-material/Refresh'
import { Box, Button, Paper, Skeleton, Stack, Typography } from '@mui/material'

/** Every page opens the same way: small label, serif title, one line of context, a rule underneath. */
export function PageHeader({ eyebrow, title, description, action }) {
  return (
    <Box
      component="header"
      sx={{
        display: 'flex',
        flexDirection: { xs: 'column', sm: 'row' },
        alignItems: { xs: 'stretch', sm: 'flex-end' },
        justifyContent: 'space-between',
        gap: 2,
        pb: 2.5,
        borderBottom: 1,
        borderColor: 'divider',
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        {eyebrow && (
          <Typography variant="overline" component="p" color="text.secondary" sx={{ mb: 0.5 }}>
            {eyebrow}
          </Typography>
        )}
        <Typography variant="h4" component="h1" sx={{ fontSize: { xs: '1.75rem', md: '2.125rem' } }}>
          {title}
        </Typography>
        {description && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, maxWidth: 560 }}>
            {description}
          </Typography>
        )}
      </Box>
      {action && <Box sx={{ flexShrink: 0 }}>{action}</Box>}
    </Box>
  )
}

/** Nothing here yet - say what to do about it. */
export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <Stack spacing={1.25} sx={{ alignItems: 'center', py: { xs: 5, md: 6 }, px: 3, textAlign: 'center' }}>
      {Icon && <Icon sx={{ fontSize: 28, color: 'text.secondary' }} aria-hidden />}
      <Typography variant="subtitle1">{title}</Typography>
      {description && (
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 380 }}>
          {description}
        </Typography>
      )}
      {action && <Box sx={{ pt: 1 }}>{action}</Box>}
    </Stack>
  )
}

/** Failure with a way out, never a raw stack trace. */
export function ErrorState({ message, onRetry, compact = false }) {
  return (
    <Stack spacing={1.25} sx={{ alignItems: 'center', py: compact ? 3 : 6, px: 3, textAlign: 'center' }}>
      <Typography variant="subtitle1">Something went wrong</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 380 }}>
        {message || 'Please try again in a moment.'}
      </Typography>
      {onRetry && (
        <Button startIcon={<RefreshIcon />} onClick={onRetry} variant="outlined">
          Retry
        </Button>
      )}
    </Stack>
  )
}

export function ChartSkeleton({ height = 280 }) {
  return <Skeleton variant="rounded" height={height} />
}

export function TableSkeleton({ rows = 5 }) {
  return (
    <Stack spacing={1} sx={{ p: 2 }}>
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} variant="rounded" height={40} />
      ))}
    </Stack>
  )
}

/**
 * A ruled panel: label and optional action above a hairline, content below it.
 * `flush` drops the content padding for tables and lists that run edge to edge.
 */
export function SectionCard({ title, subtitle, action, children, flush = false, sx }) {
  return (
    <Paper variant="outlined" component="section" sx={{ height: '100%', overflow: 'hidden', ...sx }}>
      <Stack
        direction="row"
        sx={{ justifyContent: 'space-between', alignItems: 'center', px: 2.5, minHeight: 48, gap: 1, borderBottom: 1, borderColor: 'divider' }}
      >
        <Stack direction="row" sx={{ alignItems: 'baseline', minWidth: 0, columnGap: 1.25, flexWrap: 'wrap' }}>
          <Typography variant="overline" component="h2">
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="caption" noWrap>
              {subtitle}
            </Typography>
          )}
        </Stack>
        {action}
      </Stack>
      <Box sx={flush ? undefined : { p: 2.5 }}>{children}</Box>
    </Paper>
  )
}
