import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import {
  Box,
  Chip,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import { alpha } from '@mui/material/styles'
import { visuallyHidden } from '@mui/utils'
import { formatCurrency, formatDate, formatLongDate } from '../../utils/format'

const isIncome = (transaction) => transaction.kind === 'INCOME'

/** Amount with sign, colour AND an icon - never colour alone. */
export function Amount({ transaction, variant = 'body2' }) {
  const income = isIncome(transaction)
  return (
    <Stack direction="row" alignItems="center" spacing={0.5} justifyContent="flex-end">
      {income ? (
        <ArrowUpwardIcon sx={{ fontSize: 14 }} color="success" aria-hidden />
      ) : (
        <ArrowDownwardIcon sx={{ fontSize: 14 }} color="error" aria-hidden />
      )}
      <Typography variant={variant} fontWeight={600} color={income ? 'success.main' : 'error.main'} noWrap>
        <Box component="span" sx={visuallyHidden}>{income ? 'Income ' : 'Expense '}</Box>
        {income ? '+' : '-'}
        {formatCurrency(transaction.amount)}
      </Typography>
    </Stack>
  )
}

export function CategoryChip({ transaction, size = 'small' }) {
  return (
    <Chip
      size={size}
      label={transaction.categoryName}
      sx={{
        color: transaction.categoryColor,
        bgcolor: (theme) => alpha(transaction.categoryColor, theme.palette.mode === 'dark' ? 0.22 : 0.12),
      }}
    />
  )
}

/** Desktop view. Scrolls inside its own container rather than pushing the page sideways. */
export function TransactionTable({ transactions, onEdit, onDelete }) {
  return (
    <TableContainer sx={{ overflowX: 'auto' }}>
      <Table size="medium" sx={{ minWidth: 640 }}>
        <TableHead>
          <TableRow>
            <TableCell>Date</TableCell>
            <TableCell>Description</TableCell>
            <TableCell>Category</TableCell>
            <TableCell>Source</TableCell>
            <TableCell align="right">Amount</TableCell>
            <TableCell align="right" />
          </TableRow>
        </TableHead>
        <TableBody>
          {transactions.map((transaction) => (
            <TableRow key={transaction.id} hover>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatLongDate(transaction.spentOn)}</TableCell>
              <TableCell sx={{ maxWidth: 320 }}>
                <Typography variant="body2" noWrap title={transaction.description}>
                  {transaction.description}
                </Typography>
              </TableCell>
              <TableCell>
                <CategoryChip transaction={transaction} />
              </TableCell>
              <TableCell>
                <Typography variant="caption" color="text.secondary">
                  {transaction.source === 'CSV' ? 'Imported' : 'Manual'}
                </Typography>
              </TableCell>
              <TableCell align="right">
                <Amount transaction={transaction} />
              </TableCell>
              <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                <IconButton
                  size="small"
                  aria-label={`Edit ${transaction.description}`}
                  onClick={() => onEdit(transaction)}
                >
                  <EditOutlinedIcon fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  aria-label={`Delete ${transaction.description}`}
                  onClick={() => onDelete(transaction)}
                >
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}

/** Mobile view: one tappable card per transaction instead of a squeezed table. */
export function TransactionCards({ transactions, onEdit, onDelete }) {
  return (
    <Stack divider={<Box sx={{ borderBottom: 1, borderColor: 'divider' }} />}>
      {transactions.map((transaction) => (
        <Stack key={transaction.id} direction="row" spacing={1.5} alignItems="center" sx={{ py: 1.5, px: 2 }}>
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
          <Stack alignItems="flex-end" spacing={0.5}>
            <Amount transaction={transaction} />
            <Box>
              <IconButton
                size="small"
                aria-label={`Edit ${transaction.description}`}
                onClick={() => onEdit(transaction)}
              >
                <EditOutlinedIcon fontSize="small" />
              </IconButton>
              <IconButton
                size="small"
                aria-label={`Delete ${transaction.description}`}
                onClick={() => onDelete(transaction)}
              >
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Box>
          </Stack>
        </Stack>
      ))}
    </Stack>
  )
}
