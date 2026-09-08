import AddIcon from '@mui/icons-material/Add'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import SavingsIcon from '@mui/icons-material/Savings'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useCallback, useEffect, useState } from 'react'
import client, { errorMessage } from '../api/client'
import ConfirmDialog from '../components/common/ConfirmDialog.jsx'
import { useFeedback } from '../components/common/Feedback.jsx'
import { EmptyState, ErrorState, TableSkeleton } from '../components/common/States.jsx'
import { currentMonth, formatCurrency } from '../utils/format'
import { BudgetBar } from './Dashboard.jsx'

export default function Budgets() {
  const { notify } = useFeedback()
  const [month, setMonth] = useState(currentMonth)
  const [budgets, setBudgets] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    setError('')
    Promise.all([client.get('/budgets', { params: { month } }), client.get('/categories')])
      .then(([budgetsResponse, categoriesResponse]) => {
        setBudgets(budgetsResponse.data)
        setCategories(categoriesResponse.data)
      })
      .catch((e) => setError(errorMessage(e, 'Could not load your budgets')))
      .finally(() => setLoading(false))
  }, [month])

  useEffect(load, [load])

  const remove = async () => {
    try {
      await client.delete(`/budgets/${deleting.id}`)
      notify('Budget deleted')
      setDeleting(null)
      load()
    } catch (e) {
      notify(errorMessage(e, 'Could not delete the budget'), 'error')
    }
  }

  const totalLimit = budgets.reduce((sum, budget) => sum + Number(budget.monthlyLimit), 0)
  const totalSpent = budgets.reduce((sum, budget) => sum + Number(budget.spent), 0)

  return (
    <Stack spacing={2}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', sm: 'center' }}
        spacing={2}
      >
        <Box>
          <Typography variant="h5">Budgets</Typography>
          <Typography variant="body2" color="text.secondary">
            Set a monthly limit per category and track what is left.
          </Typography>
        </Box>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <TextField
            label="Month"
            type="month"
            size="small"
            value={month}
            onChange={(event) => setMonth(event.target.value || currentMonth())}
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{ width: { xs: '100%', sm: 180 } }}
          />
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setEditing({})}>
            Add budget
          </Button>
        </Stack>
      </Stack>

      {!loading && !error && budgets.length > 0 && (
        <Paper variant="outlined" sx={{ p: 2, borderRadius: 4 }}>
          <Typography variant="body2" color="text.secondary">
            Across {budgets.length} {budgets.length === 1 ? 'budget' : 'budgets'} you have spent{' '}
            <Box component="span" sx={{ color: 'text.primary', fontWeight: 600 }}>
              {formatCurrency(totalSpent)}
            </Box>{' '}
            of {formatCurrency(totalLimit)} this month.
          </Typography>
        </Paper>
      )}

      {loading ? (
        <Paper variant="outlined" sx={{ borderRadius: 4 }}>
          <TableSkeleton rows={3} />
        </Paper>
      ) : error ? (
        <Paper variant="outlined" sx={{ borderRadius: 4 }}>
          <ErrorState message={error} onRetry={load} />
        </Paper>
      ) : budgets.length === 0 ? (
        <Paper variant="outlined" sx={{ borderRadius: 4 }}>
          <EmptyState
            icon={SavingsIcon}
            title="No budgets yet"
            description="Pick a category and a monthly limit - the dashboard will then show how much room is left."
            action={
              <Button variant="contained" startIcon={<AddIcon />} onClick={() => setEditing({})}>
                Add budget
              </Button>
            }
          />
        </Paper>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' },
          }}
        >
          {budgets.map((budget) => (
            <Card key={budget.id}>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="subtitle1" noWrap>
                      {budget.categoryName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {formatCurrency(budget.monthlyLimit)} monthly limit
                    </Typography>
                  </Box>
                  <Box sx={{ flexShrink: 0 }}>
                    <IconButton
                      size="small"
                      aria-label={`Edit ${budget.categoryName} budget`}
                      onClick={() => setEditing(budget)}
                    >
                      <EditOutlinedIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      aria-label={`Delete ${budget.categoryName} budget`}
                      onClick={() => setDeleting(budget)}
                    >
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </Stack>
                <Box sx={{ mt: 2 }}>
                  <BudgetBar budget={budget} showName={false} />
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}

      <BudgetForm
        budget={editing}
        categories={categories}
        existing={budgets}
        onClose={() => setEditing(null)}
        onSaved={(message) => {
          setEditing(null)
          notify(message)
          load()
        }}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete this budget?"
        description={deleting ? `The ${deleting.categoryName} budget will be removed. Transactions stay.` : ''}
        onConfirm={remove}
        onClose={() => setDeleting(null)}
      />
    </Stack>
  )
}

function BudgetForm({ budget, categories, existing, onClose, onSaved }) {
  const [form, setForm] = useState({ categoryId: '', monthlyLimit: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!budget) return
    setForm({ categoryId: budget.categoryId ?? '', monthlyLimit: budget.monthlyLimit ?? '' })
    setError('')
  }, [budget])

  if (!budget) return null

  // one budget per category, so hide the ones already taken
  const taken = new Set(existing.filter((item) => item.id !== budget.id).map((item) => item.categoryId))
  const available = categories.filter((category) => !taken.has(category.id))

  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    const payload = { categoryId: form.categoryId, monthlyLimit: Number(form.monthlyLimit) }
    try {
      if (budget.id) await client.put(`/budgets/${budget.id}`, payload)
      else await client.post('/budgets', payload)
      onSaved(budget.id ? 'Budget updated' : 'Budget created')
    } catch (e) {
      setError(errorMessage(e, 'Could not save the budget'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open onClose={busy ? undefined : onClose} fullWidth maxWidth="xs">
      <form onSubmit={submit}>
        <DialogTitle>{budget.id ? 'Edit budget' : 'Add budget'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField
              select
              required
              label="Category"
              value={form.categoryId}
              onChange={(event) => setForm({ ...form, categoryId: event.target.value })}
              helperText="Each category can have one budget"
            >
              {available.map((category) => (
                <MenuItem key={category.id} value={category.id}>
                  {category.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              required
              label="Monthly limit"
              type="number"
              value={form.monthlyLimit}
              onChange={(event) => setForm({ ...form, monthlyLimit: event.target.value })}
              slotProps={{
                input: { startAdornment: <InputAdornment position="start">₹</InputAdornment> },
                htmlInput: { step: '0.01', min: '1', inputMode: 'decimal' },
              }}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={busy || !form.categoryId}>
            {busy ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}
