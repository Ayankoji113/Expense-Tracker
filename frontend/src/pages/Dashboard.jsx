import { Alert, Box, Card, CardContent, Paper, Skeleton, TextField, Typography } from '@mui/material'
import { useEffect, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import client, { errorMessage } from '../api/client'

const currency = (value) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(Number(value || 0))

export default function Dashboard() {
  const [range, setRange] = useState({ from: '', to: '' })
  const [data, setData] = useState({ summary: null, byCategory: [], monthly: [] })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const params = {}
    if (range.from) params.from = range.from
    if (range.to) params.to = range.to
    setLoading(true)
    Promise.all([
      client.get('/reports/summary', { params }),
      client.get('/reports/by-category', { params }),
      client.get('/reports/monthly', { params: { months: 12 } }),
    ])
      .then(([summary, byCategory, monthly]) =>
        setData({ summary: summary.data, byCategory: byCategory.data, monthly: monthly.data }),
      )
      .catch((e) => setError(errorMessage(e, 'Could not load reports')))
      .finally(() => setLoading(false))
  }, [range])

  const { summary, byCategory, monthly } = data

  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, flexGrow: 1 }}>
          Dashboard
        </Typography>
        <TextField
          label="From"
          type="date"
          size="small"
          slotProps={{ inputLabel: { shrink: true } }}
          value={range.from}
          onChange={(e) => setRange({ ...range, from: e.target.value })}
        />
        <TextField
          label="To"
          type="date"
          size="small"
          slotProps={{ inputLabel: { shrink: true } }}
          value={range.to}
          onChange={(e) => setRange({ ...range, to: e.target.value })}
        />
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: 'repeat(4, 1fr)' }, mb: 3 }}>
        <Stat label="Total spent" value={loading ? null : currency(summary?.total)} />
        <Stat label="Transactions" value={loading ? null : String(summary?.count ?? 0)} />
        <Stat label="Average" value={loading ? null : currency(summary?.average)} />
        <Stat label="Top category" value={loading ? null : summary?.topCategory || '--'} />
      </Box>

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
        <Panel title="Spending by category">
          {byCategory.length === 0 ? (
            <Empty loading={loading} />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                {/* animation off: Recharts marks stay at their zero state under React StrictMode */}
                <Pie
                  data={byCategory}
                  dataKey="total"
                  nameKey="category"
                  outerRadius={100}
                  isAnimationActive={false}
                  label={({ percent }) => (percent > 0.05 ? `${Math.round(percent * 100)}%` : '')}
                >
                  {byCategory.map((slice) => (
                    <Cell key={slice.category} fill={slice.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => currency(value)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Panel>

        <Panel title="Monthly spend">
          {monthly.length === 0 ? (
            <Empty loading={loading} />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" />
                <YAxis width={70} />
                <Tooltip formatter={(value) => currency(value)} />
                <Bar dataKey="total" fill="#1565c0" radius={[6, 6, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>
      </Box>
    </Box>
  )
}

function Stat({ label, value }) {
  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="body2" color="text.secondary">
          {label}
        </Typography>
        <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.5 }}>
          {value === null ? <Skeleton width="70%" /> : value}
        </Typography>
      </CardContent>
    </Card>
  )
}

function Panel({ title, children }) {
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
        {title}
      </Typography>
      {children}
    </Paper>
  )
}

function Empty({ loading }) {
  return (
    <Box sx={{ height: 300, display: 'grid', placeItems: 'center' }}>
      {loading ? <Skeleton variant="rounded" width="90%" height={260} /> : (
        <Typography color="text.secondary">No expenses in this range yet</Typography>
      )}
    </Box>
  )
}
