import AddIcon from '@mui/icons-material/Add'
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong'
import { Box, Button, Paper, Stack, TablePagination, Typography, useMediaQuery } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import client, { errorMessage } from '../api/client'
import ConfirmDialog from '../components/common/ConfirmDialog.jsx'
import { useFeedback } from '../components/common/Feedback.jsx'
import { EmptyState, ErrorState, TableSkeleton } from '../components/common/States.jsx'
import TransactionFilters, { EMPTY_FILTERS } from '../components/transactions/TransactionFilters.jsx'
import TransactionForm from '../components/transactions/TransactionForm.jsx'
import { TransactionCards, TransactionTable } from '../components/transactions/TransactionList.jsx'

const DEBOUNCE_MS = 300

export default function Transactions() {
  const theme = useTheme()
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'))
  const { notify } = useFeedback()

  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [pagination, setPagination] = useState({ page: 0, size: 25 })
  const [result, setResult] = useState({ content: [], totalElements: 0 })
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)

  // one request per typing pause, not per keystroke
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(filters.q), DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [filters.q])

  const query = useMemo(
    () => ({ ...filters, q: debouncedSearch, ...pagination }),
    [filters, debouncedSearch, pagination],
  )

  const load = useCallback(() => {
    const params = { page: query.page, size: query.size }
    for (const key of ['from', 'to', 'kind', 'categoryId', 'q']) {
      if (query[key]) params[key] = query[key]
    }
    setLoading(true)
    setError('')
    client
      .get('/expenses', { params })
      .then(({ data }) => setResult(data))
      .catch((e) => setError(errorMessage(e, 'Could not load transactions')))
      .finally(() => setLoading(false))
  }, [query])

  useEffect(load, [load])

  useEffect(() => {
    client
      .get('/categories')
      .then(({ data }) => setCategories(data))
      .catch(() => setCategories([]))
  }, [])

  const remove = async () => {
    try {
      await client.delete(`/expenses/${deleting.id}`)
      notify('Transaction deleted')
      setDeleting(null)
      load()
    } catch (e) {
      notify(errorMessage(e, 'Could not delete the transaction'), 'error')
    }
  }

  const changeFilters = (next) => {
    setFilters(next)
    setPagination((current) => ({ ...current, page: 0 }))
  }

  const hasFilters = Object.keys(EMPTY_FILTERS).some((key) => filters[key])

  return (
    <Stack spacing={2}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', sm: 'center' }}
        spacing={2}
      >
        <Box>
          <Typography variant="h5">Transactions</Typography>
          <Typography variant="body2" color="text.secondary">
            Manage your income and expenses.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setEditing({})}
          sx={{ alignSelf: { xs: 'stretch', sm: 'center' } }}
        >
          Add transaction
        </Button>
      </Stack>

      <TransactionFilters filters={filters} categories={categories} onChange={changeFilters} />

      <Paper variant="outlined" sx={{ borderRadius: 4, overflow: 'hidden' }}>
        {loading ? (
          <TableSkeleton rows={6} />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : result.content.length === 0 ? (
          <EmptyState
            icon={ReceiptLongIcon}
            title={hasFilters ? 'No matching transactions' : 'No transactions yet'}
            description={
              hasFilters
                ? 'Try widening the date range or clearing the filters.'
                : 'Start tracking your spending by adding your first transaction, or import a bank CSV.'
            }
            action={
              hasFilters ? (
                <Button variant="outlined" onClick={() => changeFilters({ ...EMPTY_FILTERS })}>
                  Clear filters
                </Button>
              ) : (
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                  <Button variant="contained" startIcon={<AddIcon />} onClick={() => setEditing({})}>
                    Add transaction
                  </Button>
                  <Button variant="outlined" component={Link} to="/import">
                    Import CSV
                  </Button>
                </Stack>
              )
            }
          />
        ) : isDesktop ? (
          <TransactionTable transactions={result.content} onEdit={setEditing} onDelete={setDeleting} />
        ) : (
          <TransactionCards transactions={result.content} onEdit={setEditing} onDelete={setDeleting} />
        )}

        {!loading && !error && result.totalElements > 0 && (
          <TablePagination
            component="div"
            count={result.totalElements}
            page={pagination.page}
            rowsPerPage={pagination.size}
            onPageChange={(_, page) => setPagination((current) => ({ ...current, page }))}
            onRowsPerPageChange={(event) => setPagination({ page: 0, size: Number(event.target.value) })}
            rowsPerPageOptions={[10, 25, 50]}
            sx={{ borderTop: 1, borderColor: 'divider' }}
          />
        )}
      </Paper>

      <TransactionForm
        transaction={editing}
        categories={categories}
        onClose={() => setEditing(null)}
        onSaved={(message) => {
          setEditing(null)
          notify(message)
          load()
        }}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete this transaction?"
        description={deleting ? `"${deleting.description}" will be permanently removed.` : ''}
        onConfirm={remove}
        onClose={() => setDeleting(null)}
      />
    </Stack>
  )
}
