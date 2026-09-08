import RefreshIcon from '@mui/icons-material/Refresh'
import { Box, Button, Card, CardContent, Paper, Skeleton, Stack, Typography } from '@mui/material'

/** Nothing here yet - say what to do about it. */
export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <Stack alignItems="center" spacing={1.5} sx={{ py: { xs: 5, md: 7 }, px: 3, textAlign: 'center' }}>
      {Icon && (
        <Box
          sx={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            display: 'grid',
            placeItems: 'center',
            bgcolor: 'action.hover',
            color: 'text.secondary',
          }}
        >
          <Icon fontSize="medium" />
        </Box>
      )}
      <Typography variant="subtitle1">{title}</Typography>
      {description && (
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 380 }}>
          {description}
        </Typography>
      )}
      {action}
    </Stack>
  )
}

/** Failure with a way out, never a raw stack trace. */
export function ErrorState({ message, onRetry, compact = false }) {
  return (
    <Stack alignItems="center" spacing={1.5} sx={{ py: compact ? 3 : 6, px: 3, textAlign: 'center' }}>
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

export function StatCardSkeleton() {
  return (
    <Card>
      <CardContent>
        <Skeleton width="45%" height={18} />
        <Skeleton width="70%" height={40} sx={{ mt: 1 }} />
        <Skeleton width="35%" height={16} />
      </CardContent>
    </Card>
  )
}

export function ChartSkeleton({ height = 280 }) {
  return <Skeleton variant="rounded" height={height} sx={{ borderRadius: 2 }} />
}

export function TableSkeleton({ rows = 5 }) {
  return (
    <Stack spacing={1} sx={{ p: 2 }}>
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} variant="rounded" height={44} />
      ))}
    </Stack>
  )
}

/** Card wrapper for a titled section, with an optional right-hand action. */
export function SectionCard({ title, subtitle, action, children, sx }) {
  return (
    <Paper variant="outlined" sx={{ borderRadius: 4, p: { xs: 2, md: 2.5 }, height: '100%', ...sx }}>
      <Stack
        direction="row"
        alignItems="flex-start"
        justifyContent="space-between"
        spacing={1}
        sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}
      >
        <Box>
          <Typography variant="subtitle1">{title}</Typography>
          {subtitle && (
            <Typography variant="body2" color="text.secondary">
              {subtitle}
            </Typography>
          )}
        </Box>
        {action}
      </Stack>
      {children}
    </Paper>
  )
}
