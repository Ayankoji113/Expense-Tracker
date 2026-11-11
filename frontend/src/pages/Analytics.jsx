import { Box, Paper, Stack, TextField, Typography } from '@mui/material'
import { useCallback, useEffect, useState } from 'react'
import client, { errorMessage } from '../api/client'
import { CategoryDonut, IncomeExpenseChart, SpendTrendChart } from '../components/charts/Charts.jsx'
import { ChartSkeleton, EmptyState, ErrorState, PageHeader, SectionCard } from '../components/common/States.jsx'
import StatCard, { StatStrip, StatStripSkeleton } from '../components/dashboard/StatCard.jsx'
import { mono } from '../theme'
import { currentMonth, formatCurrency, formatLongDate, formatPercent, monthRange } from '../utils/format'

const defaultRange = () => monthRange(currentMonth())

export default function Analytics() {
  const [range, setRange] = useState(defaultRange)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // a half-typed or back-to-front range is not worth a request
  const rangeValid = Boolean(range.from && range.to && range.from <= range.to)

  const load = useCallback(() => {
    if (!rangeValid) return
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
  }, [range, rangeValid])

  useEffect(load, [load])

  const summary = data?.summary
  const rangeLabel = rangeValid ? `${formatLongDate(range.from)} to ${formatLongDate(range.to)}` : 'Selected range'

  return (
    <Stack spacing={3}>
      <PageHeader
        eyebrow="Plan"
        title="Analytics"
        description="Where the money went, over any period you choose."
        action={
          <Stack direction="row" spacing={1.5}>
            <TextField
              label="From"
              type="date"
              size="small"
              value={range.from}
              onChange={(event) => setRange({ ...range, from: event.target.value })}
              error={!rangeValid}
              slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: range.to || undefined } }}
              fullWidth
            />
            <TextField
              label="To"
              type="date"
              size="small"
              value={range.to}
              onChange={(event) => setRange({ ...range, to: event.target.value })}
              error={!rangeValid}
              slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: range.from || undefined } }}
              fullWidth
            />
          </Stack>
        }
      />

      {!rangeValid ? (
        <Paper variant="outlined">
          <EmptyState title="Pick a date range" description="The start date has to be on or before the end date." />
        </Paper>
      ) : error && !loading ? (
        <Paper variant="outlined">
          <ErrorState message={error} onRetry={load} />
        </Paper>
      ) : (
        <>
          {loading ? (
            <StatStripSkeleton count={5} />
          ) : (
            <StatStrip columns={5}>
              <StatCard
                label="Total spending"
                value={formatCurrency(summary.expense)}
                caption={`${summary.transactionCount} ${summary.transactionCount === 1 ? 'transaction' : 'transactions'}`}
              />
              <StatCard
                label="Average per day"
                value={formatCurrency(summary.averageDailyExpense)}
                caption="Over the days so far"
              />
              <StatCard
                label="Top category"
                value={summary.topCategory || '--'}
                numeric={false}
                caption="Highest spend"
              />
              <StatCard
                label="Largest expense"
                value={formatCurrency(summary.largestExpense)}
                caption="Single transaction"
              />
              <StatCard
                label="Net savings"
                value={formatCurrency(summary.balance)}
                tone={Number(summary.balance) < 0 ? 'error' : undefined}
                caption={
                  summary.savingsRate === null
                    ? 'Add income to see a rate'
                    : `${formatPercent(summary.savingsRate)} of income`
                }
              />
            </StatStrip>
          )}

          <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', lg: '2fr 3fr' } }}>
            <SectionCard title="Category split" subtitle={rangeLabel}>
              {loading ? (
                <ChartSkeleton />
              ) : data.byCategory.length === 0 ? (
                <EmptyState title="No spending in this range" description="Try a wider date range." />
              ) : (
                <CategoryDonut data={data.byCategory} />
              )}
            </SectionCard>

            <SectionCard title="Income and expenses" subtitle="Last 12 months">
              {loading ? (
                <ChartSkeleton />
              ) : data.monthly.length === 0 ? (
                <EmptyState title="Nothing to chart yet" description="Add transactions to build a history." />
              ) : (
                <IncomeExpenseChart data={data.monthly} />
              )}
            </SectionCard>
          </Box>

          <SectionCard title="Daily spending" subtitle={rangeLabel}>
            {loading ? (
              <ChartSkeleton height={260} />
            ) : data.daily.length === 0 ? (
              <EmptyState title="No spending in this range" description="Days you spend on will show up here." />
            ) : (
              <SpendTrendChart data={data.daily} height={260} />
            )}
          </SectionCard>

          <SectionCard title="Category breakdown" subtitle="Share of total spending" flush>
            {loading ? (
              <Box sx={{ p: 2.5 }}>
                <ChartSkeleton height={160} />
              </Box>
            ) : data.byCategory.length === 0 ? (
              <EmptyState title="Nothing to break down yet" />
            ) : (
              <Stack divider={<Box sx={{ borderBottom: 1, borderColor: 'divider' }} />}>
                {data.byCategory.map((slice) => (
                  <Box
                    key={slice.category}
                    sx={{
                      display: 'grid',
                      alignItems: 'center',
                      columnGap: 2,
                      rowGap: 0.75,
                      px: 2.5,
                      py: 1.5,
                      gridTemplateColumns: { xs: '1fr auto', md: '200px 1fr 56px 120px' },
                    }}
                  >
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', minWidth: 0 }}>
                      <Box
                        aria-hidden
                        sx={{ width: 8, height: 8, borderRadius: '2px', bgcolor: slice.color, flexShrink: 0 }}
                      />
                      <Typography variant="body2" noWrap>
                        {slice.category}
                      </Typography>
                      <Typography variant="caption" sx={{ flexShrink: 0 }}>
                        {slice.count} {slice.count === 1 ? 'txn' : 'txns'}
                      </Typography>
                    </Stack>
                    <Box
                      sx={{
                        height: 6,
                        borderRadius: '2px',
                        bgcolor: 'action.hover',
                        overflow: 'hidden',
                        gridColumn: { xs: '1 / -1', md: 'auto' },
                        gridRow: { xs: 2, md: 'auto' },
                      }}
                    >
                      <Box
                        sx={{ width: `${Math.min(Number(slice.percentage), 100)}%`, height: '100%', bgcolor: slice.color }}
                      />
                    </Box>
                    <Typography variant="caption" sx={{ ...mono, textAlign: 'right', display: { xs: 'none', md: 'block' } }}>
                      {formatPercent(slice.percentage)}
                    </Typography>
                    <Typography variant="body2" noWrap sx={{ ...mono, fontWeight: 500, textAlign: 'right' }}>
                      {formatCurrency(slice.total)}
                    </Typography>
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
