import { Box, Paper, Stack, Typography, useTheme } from '@mui/material'
import {
  Area,
  AreaChart,
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
import { formatCurrency, formatCurrencyAxis, formatDate, formatMonthLabel } from '../../utils/format'

// Recharts marks stay at their zero state under React StrictMode, so animation stays off.
const CHART_PROPS = { isAnimationActive: false }

function useChartTheme() {
  const theme = useTheme()
  return {
    grid: theme.palette.divider,
    axis: theme.palette.text.secondary,
    income: theme.palette.success.main,
    expense: theme.palette.error.main,
    accent: theme.palette.primary.main,
  }
}

function ChartTooltip({ active, payload, label, labelFormatter }) {
  if (!active || !payload?.length) return null
  return (
    <Paper variant="outlined" sx={{ px: 1.5, py: 1, borderRadius: 2, boxShadow: 3 }}>
      <Typography variant="caption" color="text.secondary">
        {labelFormatter ? labelFormatter(label) : label}
      </Typography>
      <Stack spacing={0.25} sx={{ mt: 0.5 }}>
        {payload.map((entry) => (
          <Stack key={entry.name} direction="row" spacing={1} alignItems="center">
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: entry.color || entry.payload?.color }} />
            <Typography variant="body2" sx={{ flexGrow: 1 }}>
              {entry.name}
            </Typography>
            <Typography variant="body2" fontWeight={600}>
              {formatCurrency(entry.value)}
            </Typography>
          </Stack>
        ))}
      </Stack>
    </Paper>
  )
}

export function IncomeExpenseChart({ data, height = 300 }) {
  const colors = useChartTheme()
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={colors.grid} />
        <XAxis dataKey="month" tickFormatter={formatMonthLabel} tick={{ fill: colors.axis, fontSize: 12 }} />
        <YAxis tickFormatter={formatCurrencyAxis} tick={{ fill: colors.axis, fontSize: 12 }} width={70} />
        <Tooltip content={<ChartTooltip labelFormatter={formatMonthLabel} />} cursor={{ fillOpacity: 0.06 }} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="income" name="Income" fill={colors.income} radius={[6, 6, 0, 0]} {...CHART_PROPS} />
        <Bar dataKey="expense" name="Expense" fill={colors.expense} radius={[6, 6, 0, 0]} {...CHART_PROPS} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function CategoryDonut({ data, height = 300 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          dataKey="total"
          nameKey="category"
          innerRadius="55%"
          outerRadius="80%"
          paddingAngle={2}
          {...CHART_PROPS}
        >
          {data.map((slice) => (
            <Cell key={slice.category} fill={slice.color} stroke="none" />
          ))}
        </Pie>
        <Tooltip content={<ChartTooltip />} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  )
}

export function SpendTrendChart({ data, height = 300 }) {
  const colors = useChartTheme()
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="spendTrend" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={colors.accent} stopOpacity={0.35} />
            <stop offset="100%" stopColor={colors.accent} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={colors.grid} />
        <XAxis dataKey="day" tickFormatter={formatDate} tick={{ fill: colors.axis, fontSize: 12 }} minTickGap={24} />
        <YAxis tickFormatter={formatCurrencyAxis} tick={{ fill: colors.axis, fontSize: 12 }} width={70} />
        <Tooltip content={<ChartTooltip labelFormatter={formatDate} />} />
        <Area
          type="monotone"
          dataKey="expense"
          name="Spent"
          stroke={colors.accent}
          strokeWidth={2}
          fill="url(#spendTrend)"
          {...CHART_PROPS}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
