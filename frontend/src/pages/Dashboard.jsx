import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet'
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong'
import SavingsIcon from '@mui/icons-material/Savings'
import TrendingDownIcon from '@mui/icons-material/TrendingDown'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import { Box, Button, LinearProgress, Paper, Stack, TextField, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import client, { errorMessage } from '../api/client'
import { useAuth } from '../auth/AuthContext.jsx'
import { CategoryDonut, IncomeExpenseChart, SpendTrendChart } from '../components/charts/Charts.jsx'
import {
  ChartSkeleton,
  EmptyState,
  ErrorState,
  SectionCard,
  StatCardSkeleton,
  TableSkeleton,
} from '../components/common/States.jsx'
import StatCard from '../components/dashboard/StatCard.jsx'
import { Amount, CategoryChip } from '../components/transactions/TransactionList.jsx'
import { currentMonth, formatCurrency, formatDate, formatPercent, greeting, monthRange } from '../utils/format'

export default function Dashboard() {
  const { email } = useAuth()
  const [month, setMonth] = useState(currentMonth)
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    const { from, to } = monthRange(month)
    setLoading(true)
    setError('')
    Promise.all([
      client.get('/reports/summary', { params: { from, to } }),
      client.get('/reports/by-category', { params: { from, to } }),
      client.get('/reports/monthly', { params: { months: 6 } }),
      client.get('/reports/daily', { params: { from, to } }),
      client.get('/expenses', { params: { from, to, page: 0, size: 5 } }),
      client.get('/budgets', { params: { month } }),
    ])
      .then(([summary, byCategory, monthly, daily, recent, budgets]) =>
        setData({
          summary: summary.data,
          byCategory: byCategory.data,
          monthly: monthly.data,
          daily: daily.data,
          recent: recent.data.content,
          budgets: budgets.data,
        }),
      )
      .catch((e) => setError(errorMessage(e, 'Could not load your dashboard')))
      .finally(() => setLoading(false))
  }, [month])

  useEffect(load, [load])

  const summary = data?.summary
  const name = (email || '').split('@')[0]

  return (
    <Stack spacing={3}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        justifyContent="space-between"
        spacing={2}
      >
        <Box>
          <Typography variant="h5">
            {greeting()}
            {name ? `, ${name}` : ''}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Here is your financial overview.
          </Typography>
        </Box>
        <TextField
          label="Month"
          type="month"
          size="small"
          value={month}
          onChange={(event) => setMonth(event.target.value || currentMonth())}
          slotProps={{ inputLabel: { shrink: true } }}
          sx={{ width: { xs: '100%', sm: 190 } }}
        />
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
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' },
            }}
          >
            {loading ? (
              Array.from({ length: 4 }, (_, index) => <StatCardSkeleton key={index} />)
            ) : (
              <>
                <StatCard
                  tone="primary"
                  icon={AccountBalanceWalletIcon}
                  label="Net balance"
                  value={formatCurrency(summary.balance)}
                  caption="Income minus expenses"
                />
                <StatCard
                  tone="success"
                  icon={TrendingUpIcon}
                  label="Income"
                  value={formatCurrency(summary.income)}
                  change={summary.incomeChangePercent}
                  caption="No income recorded yet"
                />
                <StatCard
                  tone="error"
                  icon={TrendingDownIcon}
                  label="Expenses"
                  value={formatCurrency(summary.expense)}
                  change={summary.expenseChangePercent}
                  invertChange
                  caption={`${summary.transactionCount} transactions`}
                />
                <StatCard
                  tone="secondary"
                  icon={SavingsIcon}
                  label="Savings rate"
                  value={formatPercent(summary.savingsRate)}
                  caption={summary.savingsRate === null ? 'Add income to see this' : 'Of income kept this month'}
                />
              </>
            )}
          </Box>

          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '3fr 2fr' } }}>
            <SectionCard title="Income vs expenses" subtitle="Last 6 months">
              {loading ? (
                <ChartSkeleton />
              ) : data.monthly.length === 0 ? (
                <EmptyState title="Nothing to chart yet" description="Add transactions to see monthly trends." />
              ) : (
                <IncomeExpenseChart data={data.monthly} />
              )}
            </SectionCard>

            <SectionCard title="Spending by category" subtitle="Selected month">
              {loading ? (
                <ChartSkeleton />
              ) : data.byCategory.length === 0 ? (
                <EmptyState title="No spending this month" description="Categorised expenses will appear here." />
              ) : (
                <CategoryDonut data={data.byCategory} />
              )}
            </SectionCard>
          </Box>

          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '3fr 2fr' } }}>
            <SectionCard title="Daily spending" subtitle="Day by day through the month">
              {loading ? (
                <ChartSkeleton height={240} />
              ) : data.daily.length === 0 ? (
                <EmptyState title="No spending recorded" description="Days you spend on will show up here." />
              ) : (
                <SpendTrendChart data={data.daily} height={240} />
              )}
            </SectionCard>

            <SectionCard
              title="Budget progress"
              subtitle="Selected month"
              action={
                <Button component={Link} to="/budgets" size="small">
                  Manage
                </Button>
              }
            >
              {loading ? (
                <TableSkeleton rows={3} />
              ) : data.budgets.length === 0 ? (
                <EmptyState
                  icon={SavingsIcon}
                  title="No budgets set"
                  description="Set a monthly limit per category to see how much room is left."
                  action={
                    <Button component={Link} to="/budgets" variant="outlined" size="small">
                      Add a budget
                    </Button>
                  }
                />
              ) : (
                <Stack spacing={2}>
                  {data.budgets.slice(0, 4).map((budget) => (
                    <BudgetBar key={budget.id} budget={budget} />
                  ))}
                </Stack>
              )}
            </SectionCard>
          </Box>

          <SectionCard
            title="Recent transactions"
            action={
              <Button component={Link} to="/transactions" size="small">
                View all
              </Button>
            }
          >
            {loading ? (
              <TableSkeleton rows={4} />
            ) : data.recent.length === 0 ? (
              <EmptyState
                icon={ReceiptLongIcon}
                title="No transactions this month"
                description="Add your first transaction, or import a bank CSV to get started."
                action={
                  <Button component={Link} to="/transactions" variant="contained" size="small">
                    Add transaction
                  </Button>
                }
              />
            ) : (
              <Stack divider={<Box sx={{ borderBottom: 1, borderColor: 'divider' }} />}>
                {data.recent.map((transaction) => (
                  <Stack key={transaction.id} direction="row" spacing={1.5} alignItems="center" sx={{ py: 1.25 }}>
                    <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                      <Typography variant="body2" fontWeight={600} noWrap>
                        {transaction.description}
                      </Typography>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
                        <CategoryChip transaction={transaction} />
                        <Typography variant="caption" color="text.secondary">
                          {formatDate(transaction.spentOn)}
                        </Typography>
                      </Stack>
                    </Box>
                    <Amount transaction={transaction} />
                  </Stack>
                ))}
              </Stack>
            )}
          </SectionCard>
        </>
      )}
    </Stack>
  )
}

/** Green under 70%, amber to 90%, red past that - and the same story in words. */
export function BudgetBar({ budget, showName = true }) {
  const used = Number(budget.usedPercent)
  const tone = used >= 90 ? 'error' : used >= 70 ? 'warning' : 'success'
  const remaining = Number(budget.remaining)

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" spacing={1} sx={{ mb: 0.5 }}>
        {showName && (
          <Typography variant="body2" fontWeight={600} noWrap>
            {budget.categoryName}
          </Typography>
        )}
        <Typography variant="caption" color="text.secondary" noWrap sx={{ ml: 'auto' }}>
          {formatCurrency(budget.spent)} / {formatCurrency(budget.monthlyLimit)}
        </Typography>
      </Stack>
      <LinearProgress
        variant="determinate"
        value={Math.min(used, 100)}
        color={tone}
        aria-label={`${budget.categoryName} budget, ${used.toFixed(0)} percent used`}
        sx={{ bgcolor: (theme) => alpha(theme.palette[tone].main, 0.14) }}
      />
      <Stack direction="row" justifyContent="space-between" spacing={1} sx={{ mt: 0.5 }}>
        <Typography variant="caption" color={`${tone}.main`} fontWeight={600}>
          {formatPercent(used, { fractionDigits: 0 })} used
        </Typography>
        <Typography variant="caption" color="text.secondary" noWrap>
          {remaining >= 0
            ? `${formatCurrency(remaining)} remaining`
            : `${formatCurrency(Math.abs(remaining))} over budget`}
        </Typography>
      </Stack>
    </Box>
  )
}
