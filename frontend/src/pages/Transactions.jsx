import AddIcon from '@mui/icons-material/Add'
import ReceiptLongIcon from '@mui/icons-material/ReceiptLongOutlined'
import { Button, Paper, Stack, TablePagination, useMediaQuery } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import client, { errorMessage } from '../api/client'
import ConfirmDialog from '../components/common/ConfirmDialog.jsx'
import { useFeedback } from '../components/common/Feedback.jsx'
import { EmptyState, ErrorState, PageHeader, TableSkeleton } from '../components/common/States.jsx'
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
  // bumping this re-runs the fetch after a save or delete
  const [revision, setRevision] = useState(0)

  // one request per typing pause, not per keystroke
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(filters.q), DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [filters.q])

  const query = useMemo(
    () => ({ ...filters, q: debouncedSearch, ...pagination }),
    [filters, debouncedSearch, pagination],
  )

  useEffect(() => {
    // a slow earlier response must not overwrite the result of a newer query
    let stale = false
    const params = { page: query.page, size: query.size }
    for (const key of ['from', 'to', 'kind', 'categoryId', 'q']) {
      if (query[key]) params[key] = query[key]
    }
    setLoading(true)
    setError('')
    client
      .get('/expenses', { params })
      .then(({ data }) => {
        if (stale) return
        // deleting the last row of the last page leaves that page empty: step back instead
        if (data.content.length === 0 && query.page > 0) {
          setPagination((current) => ({ ...current, page: Math.max(0, (data.totalPages || 1) - 1) }))
          return
        }
        setResult(data)
        setLoading(false)
      })
      .catch((e) => {
        if (stale) return
        setError(errorMessage(e, 'Could not load transactions'))
        setLoading(false)
      })
    return () => {
      stale = true
    }
  }, [query, revision])

  const reload = useCallback(() => setRevision((current) => current + 1), [])

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
      reload()
    } catch (e) {
      notify(errorMessage(e, 'Could not delete the transaction'), 'error')
    }
  }

  const changeFilters = (next) => {
    setFilters(next)
    setPagination((current) => ({ ...current, page: 0 }))
  }

  const hasFilters = Object.keys(EMPTY_FILTERS).some((key) => filters[key])
  const addButton = (
    <Button variant="contained" startIcon={<AddIcon />} onClick={() => setEditing({})} fullWidth>
      Add transaction
    </Button>
  )

  return (
    <Stack spacing={3}>
      <PageHeader
        eyebrow="Ledger"
        title="Transactions"
        description="Everything in and out, newest first."
        action={addButton}
      />

      <TransactionFilters filters={filters} categories={categories} onChange={changeFilters} />

      <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
        {loading ? (
          <TableSkeleton rows={6} />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : result.content.length === 0 ? (
          <EmptyState
            icon={ReceiptLongIcon}
            title={hasFilters ? 'No matching transactions' : 'No transactions yet'}
            description={
              hasFilters
                ? 'Try widening the date range or clearing the filters.'
                : 'Add your first transaction by hand, or import a statement from your bank.'
            }
            action={
              hasFilters ? (
                <Button variant="outlined" onClick={() => changeFilters({ ...EMPTY_FILTERS })}>
                  Clear filters
                </Button>
              ) : (
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                  {addButton}
                  <Button variant="outlined" component={Link} to="/import" sx={{ flexShrink: 0 }}>
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
          reload()
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
