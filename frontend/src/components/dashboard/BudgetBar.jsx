import { Box, LinearProgress, Stack, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import { mono } from '../../theme'
import { formatCurrency, formatPercent } from '../../utils/format'

/** Green under 70%, ochre to 90%, terracotta past that - and the same story in words. */
export default function BudgetBar({ budget, showName = true }) {
  const used = Number(budget.usedPercent)
  const tone = used >= 90 ? 'error' : used >= 70 ? 'warning' : 'success'
  const remaining = Number(budget.remaining)

  return (
    <Box>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'baseline', justifyContent: 'space-between', mb: 0.75 }}>
        {showName && (
          <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
            {budget.categoryName}
          </Typography>
        )}
        <Typography variant="caption" noWrap sx={{ ...mono, ml: 'auto' }}>
          {formatCurrency(budget.spent)} / {formatCurrency(budget.monthlyLimit)}
        </Typography>
      </Stack>
      <LinearProgress
        variant="determinate"
        value={Math.min(used, 100)}
        color={tone}
        aria-label={`${budget.categoryName} budget, ${used.toFixed(0)} percent used`}
        sx={{ bgcolor: (theme) => alpha(theme.palette.text.primary, 0.08) }}
      />
      <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between', mt: 0.75 }}>
        <Typography variant="caption" color={`${tone}.main`} sx={{ ...mono, fontWeight: 600 }}>
          {formatPercent(used, { fractionDigits: 0 })} used
        </Typography>
        <Typography variant="caption" noWrap>
          {remaining >= 0
            ? `${formatCurrency(remaining)} left`
            : `${formatCurrency(Math.abs(remaining))} over`}
        </Typography>
      </Stack>
    </Box>
  )
}
