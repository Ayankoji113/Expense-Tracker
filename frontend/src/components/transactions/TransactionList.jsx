import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import {
  Box,
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
import { visuallyHidden } from '@mui/utils'
import { mono } from '../../theme'
import { formatCurrency, formatDate, formatLongDate } from '../../utils/format'

const isIncome = (transaction) => transaction.kind === 'INCOME'

/**
 * Money in is green with a plus, money out is plain ink with a minus - a page of red figures says
 * nothing. The sign and a spoken label carry the meaning, never colour alone.
 */
export function Amount({ transaction, variant = 'body2' }) {
  const income = isIncome(transaction)
  return (
    <Typography
      variant={variant}
      component="span"
      noWrap
      sx={{ ...mono, display: 'block', textAlign: 'right', fontWeight: 500, color: income ? 'success.main' : 'text.primary' }}
    >
      <Box component="span" sx={visuallyHidden}>
        {income ? 'Income ' : 'Expense '}
      </Box>
      {income ? '+' : '−'}
      {formatCurrency(transaction.amount)}
    </Typography>
  )
}

/** Colour identifies the category; the name is always readable text beside it. */
export function CategoryTag({ transaction }) {
  return (
    <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', minWidth: 0 }}>
      <Box
        aria-hidden
        sx={{ width: 8, height: 8, borderRadius: '2px', bgcolor: transaction.categoryColor, flexShrink: 0 }}
      />
      <Typography variant="caption" noWrap>
        {transaction.categoryName}
      </Typography>
    </Stack>
  )
}

function RowActions({ transaction, onEdit, onDelete }) {
  return (
    <>
      <IconButton size="small" aria-label={`Edit ${transaction.description}`} onClick={() => onEdit(transaction)}>
        <EditOutlinedIcon fontSize="small" />
      </IconButton>
      <IconButton size="small" aria-label={`Delete ${transaction.description}`} onClick={() => onDelete(transaction)}>
        <DeleteOutlineIcon fontSize="small" />
      </IconButton>
    </>
  )
}

/** Desktop view. Scrolls inside its own container rather than pushing the page sideways. */
export function TransactionTable({ transactions, onEdit, onDelete }) {
  return (
    <TableContainer sx={{ overflowX: 'auto' }}>
      <Table sx={{ minWidth: 640 }}>
        <TableHead>
          <TableRow>
            <TableCell>Date</TableCell>
            <TableCell>Description</TableCell>
            <TableCell>Category</TableCell>
            <TableCell align="right">Amount</TableCell>
            <TableCell align="right">
              <Box component="span" sx={visuallyHidden}>
                Actions
              </Box>
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {transactions.map((transaction) => (
            <TableRow
              key={transaction.id}
              hover
              sx={{
                '&:last-child td': { borderBottom: 0 },
                // quiet until the row is in use, but always there for touch and keyboard
                '& .row-actions': { opacity: 0.45 },
                '&:hover .row-actions, &:focus-within .row-actions': { opacity: 1 },
              }}
            >
              <TableCell sx={{ ...mono, whiteSpace: 'nowrap', color: 'text.secondary', fontSize: '0.8125rem' }}>
                {formatLongDate(transaction.spentOn)}
              </TableCell>
              <TableCell sx={{ maxWidth: 360 }}>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                  <Typography variant="body2" noWrap title={transaction.description}>
                    {transaction.description}
                  </Typography>
                  {transaction.source === 'CSV' && (
                    <Typography variant="overline" color="text.secondary" sx={{ fontSize: '0.625rem', flexShrink: 0 }}>
                      Imported
                    </Typography>
                  )}
                </Stack>
              </TableCell>
              <TableCell>
                <CategoryTag transaction={transaction} />
              </TableCell>
              <TableCell align="right">
                <Amount transaction={transaction} />
              </TableCell>
              <TableCell align="right" className="row-actions" sx={{ whiteSpace: 'nowrap', width: 88, py: 0.5 }}>
                <RowActions transaction={transaction} onEdit={onEdit} onDelete={onDelete} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}

/** Mobile view: one row per transaction instead of a squeezed table. */
export function TransactionCards({ transactions, onEdit, onDelete }) {
  return (
    <Stack divider={<Box sx={{ borderBottom: 1, borderColor: 'divider' }} />}>
      {transactions.map((transaction) => (
        <Stack key={transaction.id} direction="row" spacing={1.5} sx={{ alignItems: 'center', py: 1.5, px: 2 }}>
          <Box sx={{ minWidth: 0, flexGrow: 1 }}>
            <Typography variant="body2" noWrap sx={{ fontWeight: 500 }}>
              {transaction.description}
            </Typography>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mt: 0.5 }}>
              <Typography variant="caption" sx={{ ...mono, flexShrink: 0 }}>
                {formatDate(transaction.spentOn)}
              </Typography>
              <CategoryTag transaction={transaction} />
            </Stack>
          </Box>
          <Stack sx={{ alignItems: 'flex-end' }}>
            <Amount transaction={transaction} />
            <Box sx={{ mr: -0.75 }}>
              <RowActions transaction={transaction} onEdit={onEdit} onDelete={onDelete} />
            </Box>
          </Stack>
        </Stack>
      ))}
    </Stack>
  )
}
