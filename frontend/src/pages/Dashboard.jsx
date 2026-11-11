import ReceiptLongIcon from '@mui/icons-material/ReceiptLongOutlined'
import { Box, Button, Paper, Stack, TextField, Typography } from '@mui/material'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import client, { errorMessage } from '../api/client'
import { useAuth } from '../auth/AuthContext.jsx'
import { CategoryDonut, IncomeExpenseChart, SpendTrendChart } from '../components/charts/Charts.jsx'
import {
  ChartSkeleton,
  EmptyState,
  ErrorState,
  PageHeader,
  SectionCard,
  TableSkeleton,
} from '../components/common/States.jsx'
import BudgetBar from '../components/dashboard/BudgetBar.jsx'
import StatCard, { StatStrip, StatStripSkeleton } from '../components/dashboard/StatCard.jsx'
import { Amount, CategoryTag } from '../components/transactions/TransactionList.jsx'
import { mono } from '../theme'
import {
  currentMonth,
  formatCurrency,
  formatDate,
  formatMonthLong,
  formatPercent,
  greeting,
  monthRange,
} from '../utils/format'

export default function Dashboard() {
  const { user, email } = useAuth()
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
      client.get('/expenses', { params: { from, to, page: 0, size: 6 } }),
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
  const name = user?.username || (email || '').split('@')[0]
  const viewAll = (to) => (
    <Button component={Link} to={to} size="small" color="inherit" sx={{ color: 'text.secondary', mr: -1 }}>
      View all
    </Button>
  )

  return (
    <Stack spacing={3}>
      <PageHeader
        eyebrow={formatMonthLong(month)}
        title={`${greeting()}${name ? `, ${name}` : ''}`}
        action={
          <TextField
            label="Month"
            type="month"
            size="small"
            value={month}
            onChange={(event) => setMonth(event.target.value || currentMonth())}
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{ width: { xs: '100%', sm: 190 } }}
          />
        }
      />

      {error && !loading ? (
        <Paper variant="outlined">
          <ErrorState message={error} onRetry={load} />
        </Paper>
      ) : (
        <>
          {loading ? (
            <StatStripSkeleton />
          ) : (
            <StatStrip>
              <StatCard
                label="Net balance"
                value={formatCurrency(summary.balance)}
                tone={Number(summary.balance) < 0 ? 'error' : undefined}
                caption="Income minus expenses"
              />
              <StatCard
                label="Income"
                value={formatCurrency(summary.income)}
                change={summary.incomeChangePercent}
                caption={Number(summary.income) > 0 ? 'Nothing earlier to compare with' : 'None recorded this month'}
              />
              <StatCard
                label="Expenses"
                value={formatCurrency(summary.expense)}
                change={summary.expenseChangePercent}
                invertChange
                caption={`${summary.transactionCount} ${summary.transactionCount === 1 ? 'transaction' : 'transactions'}`}
              />
              <StatCard
                label="Savings rate"
                value={formatPercent(summary.savingsRate)}
                tone={Number(summary.savingsRate) < 0 ? 'error' : undefined}
                caption={summary.savingsRate === null ? 'Add income to see this' : 'Of income kept'}
              />
            </StatStrip>
          )}

          <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', lg: '3fr 2fr' } }}>
            <SectionCard title="Income and expenses" subtitle="Last 6 months">
              {loading ? (
                <ChartSkeleton />
              ) : data.monthly.length === 0 ? (
                <EmptyState title="Nothing to chart yet" description="Add transactions to see monthly trends." />
              ) : (
                <IncomeExpenseChart data={data.monthly} />
              )}
            </SectionCard>

            <SectionCard title="Where it went" subtitle={formatMonthLong(month)}>
              {loading ? (
                <ChartSkeleton />
              ) : data.byCategory.length === 0 ? (
                <EmptyState title="No spending this month" description="Expenses will be split by category here." />
              ) : (
                <CategoryDonut data={data.byCategory} />
              )}
            </SectionCard>
          </Box>

          <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', lg: '3fr 2fr' } }}>
            <SectionCard title="Daily spending" subtitle={formatMonthLong(month)}>
              {loading ? (
                <ChartSkeleton height={240} />
              ) : data.daily.length === 0 ? (
                <EmptyState title="No spending recorded" description="Days you spend on will show up here." />
              ) : (
                <SpendTrendChart data={data.daily} height={240} />
              )}
            </SectionCard>

            <SectionCard title="Budgets" subtitle={formatMonthLong(month)} action={viewAll('/budgets')}>
              {loading ? (
                <TableSkeleton rows={3} />
              ) : data.budgets.length === 0 ? (
                <EmptyState
                  title="No budgets set"
                  description="Set a monthly limit per category to see how much room is left."
                  action={
                    <Button component={Link} to="/budgets" variant="outlined" size="small">
                      Add a budget
                    </Button>
                  }
                />
              ) : (
                <Stack spacing={2.5}>
                  {data.budgets.slice(0, 4).map((budget) => (
                    <BudgetBar key={budget.id} budget={budget} />
                  ))}
                </Stack>
              )}
            </SectionCard>
          </Box>

          <SectionCard title="Latest transactions" action={viewAll('/transactions')} flush>
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
                  <Stack key={transaction.id} direction="row" spacing={2} sx={{ alignItems: 'center', py: 1.25, px: 2.5 }}>
                    <Typography variant="caption" sx={{ ...mono, width: 52, flexShrink: 0 }}>
                      {formatDate(transaction.spentOn)}
                    </Typography>
                    <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                      <Typography variant="body2" noWrap>
                        {transaction.description}
                      </Typography>
                      <CategoryTag transaction={transaction} />
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
