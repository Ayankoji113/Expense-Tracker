import { Box, Paper, Stack, Typography, useTheme } from '@mui/material'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { fonts, mono } from '../../theme'
import { formatCurrency, formatCurrencyAxis, formatDate, formatMonthLabel, formatPercent, today } from '../../utils/format'

// Recharts marks stay at their zero state under React StrictMode, so animation stays off.
const CHART_PROPS = { isAnimationActive: false }
const MAX_FILLED_DAYS = 400

function useChartTheme() {
  const theme = useTheme()
  return {
    grid: theme.palette.divider,
    paper: theme.palette.background.paper,
    ink: theme.palette.text.primary,
    income: theme.palette.success.main,
    expense: theme.palette.error.main,
    accent: theme.palette.primary.main,
    tick: { fill: theme.palette.text.secondary, fontSize: 11, fontFamily: fonts.mono },
  }
}

function ChartTooltip({ active, payload, label, labelFormatter }) {
  if (!active || !payload?.length) return null
  return (
    <Paper variant="outlined" sx={{ px: 1.5, py: 1, boxShadow: 2 }}>
      {label !== undefined && (
        <Typography variant="caption" component="p" sx={{ mb: 0.5 }}>
          {labelFormatter ? labelFormatter(label) : label}
        </Typography>
      )}
      <Stack spacing={0.25}>
        {payload.map((entry) => (
          <Stack key={entry.name} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <Swatch color={entry.color || entry.payload?.color} />
            <Typography variant="body2" sx={{ flexGrow: 1, pr: 2 }}>
              {entry.name}
            </Typography>
            <Typography variant="body2" sx={{ ...mono, fontWeight: 500 }}>
              {formatCurrency(entry.value)}
            </Typography>
          </Stack>
        ))}
      </Stack>
    </Paper>
  )
}

function Swatch({ color }) {
  return <Box aria-hidden sx={{ width: 8, height: 8, borderRadius: '2px', bgcolor: color, flexShrink: 0 }} />
}

function Legend({ items }) {
  return (
    <Stack direction="row" spacing={2} sx={{ mb: 1.5 }}>
      {items.map(({ label, color }) => (
        <Stack key={label} direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
          <Swatch color={color} />
          <Typography variant="caption">{label}</Typography>
        </Stack>
      ))}
    </Stack>
  )
}

export function IncomeExpenseChart({ data, height = 280 }) {
  const colors = useChartTheme()
  return (
    <Box>
      <Legend
        items={[
          { label: 'Income', color: colors.income },
          { label: 'Expenses', color: colors.expense },
        ]}
      />
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barGap={3}>
          <CartesianGrid vertical={false} stroke={colors.grid} />
          <XAxis
            dataKey="month"
            tickFormatter={formatMonthLabel}
            tick={colors.tick}
            tickLine={false}
            axisLine={{ stroke: colors.grid }}
          />
          <YAxis tickFormatter={formatCurrencyAxis} tick={colors.tick} tickLine={false} axisLine={false} width={56} />
          <Tooltip
            content={<ChartTooltip labelFormatter={formatMonthLabel} />}
            cursor={{ fill: colors.ink, fillOpacity: 0.05 }}
          />
          <Bar dataKey="income" name="Income" fill={colors.income} maxBarSize={20} radius={[2, 2, 0, 0]} {...CHART_PROPS} />
          <Bar dataKey="expense" name="Expenses" fill={colors.expense} maxBarSize={20} radius={[2, 2, 0, 0]} {...CHART_PROPS} />
        </BarChart>
      </ResponsiveContainer>
    </Box>
  )
}

/** Ring with the total in the middle and its own legend, which reads better than six floating labels. */
export function CategoryDonut({ data, limit = 6 }) {
  const colors = useChartTheme()
  const total = data.reduce((sum, slice) => sum + Number(slice.total), 0)
  const listed = data.slice(0, limit)
  const hidden = data.length - listed.length

  return (
    <Box
      sx={{
        containerType: 'inline-size',
        '& > div': { display: 'grid', gap: 3, alignItems: 'center', gridTemplateColumns: '1fr' },
        '@container (min-width: 460px)': { '& > div': { gridTemplateColumns: '176px 1fr' } },
      }}
    >
      <div>
        <Box sx={{ position: 'relative', width: 176, height: 176, mx: 'auto' }}>
          <Stack
            sx={{ justifyContent: 'center', alignItems: 'center', position: 'absolute', inset: 0, pointerEvents: 'none' }}
          >
            <Typography variant="overline" color="text.secondary">
              Spent
            </Typography>
            <Typography sx={{ ...mono, fontSize: '1.125rem', fontWeight: 500 }}>
              {formatCurrency(total, { compact: total >= 1_00_000 })}
            </Typography>
          </Stack>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="total"
                nameKey="category"
                innerRadius="70%"
                outerRadius="100%"
                startAngle={90}
                endAngle={-270}
                stroke={colors.paper}
                strokeWidth={2}
                {...CHART_PROPS}
              >
                {data.map((slice) => (
                  <Cell key={slice.category} fill={slice.color} />
                ))}
              </Pie>
              <Tooltip content={<ChartTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </Box>

        <Stack component="ul" spacing={1} sx={{ m: 0, p: 0, listStyle: 'none', minWidth: 0 }}>
          {listed.map((slice) => (
            <Stack key={slice.category} component="li" direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <Swatch color={slice.color} />
              <Typography variant="body2" noWrap sx={{ flexGrow: 1, minWidth: 0 }}>
                {slice.category}
              </Typography>
              <Typography variant="caption" sx={mono}>
                {formatPercent(slice.percentage, { fractionDigits: 0 })}
              </Typography>
              <Typography variant="body2" sx={{ ...mono, minWidth: 72, textAlign: 'right' }}>
                {formatCurrency(slice.total)}
              </Typography>
            </Stack>
          ))}
          {hidden > 0 && (
            <Typography component="li" variant="caption">
              and {hidden} more
            </Typography>
          )}
        </Stack>
      </div>
    </Box>
  )
}

/** The API only returns days with spending; a day with none is a zero, not a gap to skip over. */
function fillDays(data) {
  if (data.length < 2) return data
  const spentOn = new Map(data.map((point) => [point.day, Number(point.expense)]))
  const cursor = new Date(`${data[0].day}T00:00:00`)
  const end = new Date(`${data[data.length - 1].day}T00:00:00`)
  if ((end - cursor) / 86_400_000 > MAX_FILLED_DAYS) return data

  const filled = []
  while (cursor <= end) {
    const day = today(cursor)
    filled.push({ day, expense: spentOn.get(day) ?? 0 })
    cursor.setDate(cursor.getDate() + 1)
  }
  return filled
}

export function SpendTrendChart({ data, height = 260 }) {
  const colors = useChartTheme()
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={fillDays(data)} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke={colors.grid} />
        <XAxis
          dataKey="day"
          tickFormatter={formatDate}
          tick={colors.tick}
          tickLine={false}
          axisLine={{ stroke: colors.grid }}
          minTickGap={28}
        />
        <YAxis tickFormatter={formatCurrencyAxis} tick={colors.tick} tickLine={false} axisLine={false} width={56} />
        <Tooltip content={<ChartTooltip labelFormatter={formatDate} />} cursor={{ fill: colors.ink, fillOpacity: 0.05 }} />
        <Bar dataKey="expense" name="Spent" fill={colors.accent} maxBarSize={14} radius={[1, 1, 0, 0]} {...CHART_PROPS} />
      </BarChart>
    </ResponsiveContainer>
  )
}
