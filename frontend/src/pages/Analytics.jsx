import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import CategoryIcon from '@mui/icons-material/Category'
import PaidIcon from '@mui/icons-material/Paid'
import SavingsIcon from '@mui/icons-material/Savings'
import TrendingDownIcon from '@mui/icons-material/TrendingDown'
import { Box, Paper, Stack, TextField, Typography } from '@mui/material'
import { useCallback, useEffect, useState } from 'react'
import client, { errorMessage } from '../api/client'
import { CategoryDonut, IncomeExpenseChart, SpendTrendChart } from '../components/charts/Charts.jsx'
import { ChartSkeleton, EmptyState, ErrorState, SectionCard, StatCardSkeleton } from '../components/common/States.jsx'
import StatCard from '../components/dashboard/StatCard.jsx'
import { formatCurrency, formatPercent, monthRange, currentMonth } from '../utils/format'

const defaultRange = () => monthRange(currentMonth())

export default function Analytics() {
  const [range, setRange] = useState(defaultRange)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    const params = { from: range.from, to: range.to }
    setLoading(true)
    setError('')
    Promise.all([
      client.get('/reports/summary', { params }),
      client.get('/reports/by-category', { params }),
      client.get('/reports/monthly', { params: { months: 12 } }),
      client.get('/reports/daily', { params }),
    ])
      .then(([summary, byCategory, monthly, daily]) =>
        setData({
          summary: summary.data,
          byCategory: byCategory.data,
          monthly: monthly.data,
          daily: daily.data,
        }),
      )
      .catch((e) => setError(errorMessage(e, 'Could not load analytics')))
      .finally(() => setLoading(false))
  }, [range])

  useEffect(load, [load])

  const summary = data?.summary

  return (
    <Stack spacing={3}>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', md: 'center' }}
        spacing={2}
      >
        <Box>
          <Typography variant="h5">Financial analytics</Typography>
          <Typography variant="body2" color="text.secondary">
            Where the money went, over any period you choose.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.5}>
          <TextField
            label="From"
            type="date"
            size="small"
            value={range.from}
            onChange={(event) => setRange({ ...range, from: event.target.value })}
            slotProps={{ inputLabel: { shrink: true } }}
            fullWidth
          />
          <TextField
            label="To"
            type="date"
            size="small"
            value={range.to}
            onChange={(event) => setRange({ ...range, to: event.target.value })}
            slotProps={{ inputLabel: { shrink: true } }}
            fullWidth
          />
        </Stack>
      </Stack>

      {error && !loading ? (
        <Paper variant="outlined" sx={{ borderRadius: 4 }}>
          <ErrorState message={error} onRetry={load} />
        </Paper>
      ) : (
        <>
          <Box
            sx={{
              display: 'grid',
              gap: 2,
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(5, 1fr)' },
            }}
          >
            {loading ? (
              Array.from({ length: 5 }, (_, index) => <StatCardSkeleton key={index} />)
            ) : (
              <>
                <StatCard
                  tone="error"
                  icon={TrendingDownIcon}
                  label="Total spending"
                  value={formatCurrency(summary.expense)}
                  caption={`${summary.transactionCount} transactions`}
                />
                <StatCard
                  tone="primary"
                  icon={CalendarMonthIcon}
                  label="Average per day"
                  value={formatCurrency(summary.averageDailyExpense)}
                  caption="Across the selected range"
                />
                <StatCard
                  tone="secondary"
                  icon={CategoryIcon}
                  label="Top category"
                  value={summary.topCategory || '--'}
                  caption="Highest spend"
                />
                <StatCard
                  tone="warning"
                  icon={PaidIcon}
                  label="Largest expense"
                  value={formatCurrency(summary.largestExpense)}
                  caption="Single transaction"
                />
                <StatCard
                  tone="success"
                  icon={SavingsIcon}
                  label="Net savings"
                  value={formatCurrency(summary.balance)}
                  caption={
                    summary.savingsRate === null
                      ? 'Add income to see a rate'
                      : `${formatPercent(summary.savingsRate)} of income`
                  }
                />
              </>
            )}
          </Box>

          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' } }}>
            <SectionCard title="Category distribution" subtitle="Selected range">
              {loading ? (
                <ChartSkeleton />
              ) : data.byCategory.length === 0 ? (
                <EmptyState title="No spending in this range" description="Try a wider date range." />
              ) : (
                <CategoryDonut data={data.byCategory} />
              )}
            </SectionCard>

            <SectionCard title="Income vs expenses" subtitle="Last 12 months">
              {loading ? (
                <ChartSkeleton />
              ) : data.monthly.length === 0 ? (
                <EmptyState title="Nothing to chart yet" description="Add transactions to build a history." />
              ) : (
                <IncomeExpenseChart data={data.monthly} />
              )}
            </SectionCard>
          </Box>

          <SectionCard title="Daily spending" subtitle="Selected range">
            {loading ? (
              <ChartSkeleton height={260} />
            ) : data.daily.length === 0 ? (
              <EmptyState title="No spending in this range" description="Days you spend on will show up here." />
            ) : (
              <SpendTrendChart data={data.daily} height={260} />
            )}
          </SectionCard>

          <SectionCard title="Category breakdown" subtitle="Share of total spending">
            {loading ? (
              <ChartSkeleton height={160} />
            ) : data.byCategory.length === 0 ? (
              <EmptyState title="Nothing to break down yet" />
            ) : (
              <Stack spacing={1.5}>
                {data.byCategory.map((slice) => (
                  <Box key={slice.category}>
                    <Stack direction="row" justifyContent="space-between" spacing={1}>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
                        <Box
                          sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: slice.color, flexShrink: 0 }}
                        />
                        <Typography variant="body2" noWrap>
                          {slice.category}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {slice.count} {slice.count === 1 ? 'txn' : 'txns'}
                        </Typography>
                      </Stack>
                      <Typography variant="body2" fontWeight={600} noWrap>
                        {formatCurrency(slice.total)}{' '}
                        <Box component="span" sx={{ color: 'text.secondary', fontWeight: 400 }}>
                          ({formatPercent(slice.percentage)})
                        </Box>
                      </Typography>
                    </Stack>
                    <Box
                      sx={{
                        mt: 0.75,
                        height: 6,
                        borderRadius: 999,
                        bgcolor: 'action.hover',
                        overflow: 'hidden',
                      }}
                    >
                      <Box
                        sx={{
                          width: `${Math.min(Number(slice.percentage), 100)}%`,
                          height: '100%',
                          bgcolor: slice.color,
                        }}
                      />
                    </Box>
                  </Box>
                ))}
              </Stack>
            )}
          </SectionCard>
        </>
      )}
    </Stack>
  )
}
