import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  InputAdornment,
  MenuItem,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  useMediaQuery,
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { useEffect, useState } from 'react'
import client, { errorMessage } from '../../api/client'

const today = () => new Date().toISOString().slice(0, 10)
const EMPTY = { amount: '', spentOn: today(), description: '', categoryId: '', kind: 'EXPENSE' }

/** Full-screen sheet on mobile, dialog on desktop. */
export default function TransactionForm({ transaction, categories, onClose, onSaved }) {
  const theme = useTheme()
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'))
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!transaction) return
    setForm({
      amount: transaction.amount ?? '',
      spentOn: transaction.spentOn ?? today(),
      description: transaction.description ?? '',
      categoryId: transaction.categoryId ?? '',
      kind: transaction.kind ?? 'EXPENSE',
    })
    setError('')
    setFieldErrors({})
  }, [transaction])

  if (!transaction) return null

  const validate = () => {
    const errors = {}
    if (!(Number(form.amount) > 0)) errors.amount = 'Enter an amount greater than 0'
    if (!form.description.trim()) errors.description = 'Add a short description'
    if (!form.spentOn) errors.spentOn = 'Pick a date'
    else if (form.spentOn > today()) errors.spentOn = 'Date cannot be in the future'
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const submit = async (event) => {
    event.preventDefault()
    if (!validate()) return
    setBusy(true)
    setError('')
    const payload = {
      amount: Number(form.amount),
      spentOn: form.spentOn,
      description: form.description.trim(),
      categoryId: form.categoryId || null,
      kind: form.kind,
    }
    try {
      if (transaction.id) await client.put(`/expenses/${transaction.id}`, payload)
      else await client.post('/expenses', payload)
      onSaved(transaction.id ? 'Transaction updated' : 'Transaction added')
    } catch (e) {
      setError(errorMessage(e, 'Could not save the transaction'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open onClose={busy ? undefined : onClose} fullWidth maxWidth="xs" fullScreen={fullScreen}>
      <form onSubmit={submit} noValidate>
        <DialogTitle>{transaction.id ? 'Edit transaction' : 'Add transaction'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}

            <ToggleButtonGroup
              exclusive
              fullWidth
              size="small"
              value={form.kind}
              onChange={(_, value) => value && setForm({ ...form, kind: value })}
              aria-label="Transaction type"
            >
              <ToggleButton value="EXPENSE" color="error">
                Expense
              </ToggleButton>
              <ToggleButton value="INCOME" color="success">
                Income
              </ToggleButton>
            </ToggleButtonGroup>

            <TextField
              label="Amount"
              type="number"
              required
              autoFocus
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              error={Boolean(fieldErrors.amount)}
              helperText={fieldErrors.amount}
              slotProps={{
                input: { startAdornment: <InputAdornment position="start">₹</InputAdornment> },
                htmlInput: { step: '0.01', min: '0.01', inputMode: 'decimal' },
              }}
            />

            <TextField
              label="Description"
              required
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              error={Boolean(fieldErrors.description)}
              helperText={fieldErrors.description || 'What was this for?'}
            />

            <TextField
              select
              label="Category"
              value={form.categoryId}
              onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
              helperText="Leave empty to file it under Uncategorized"
            >
              <MenuItem value="">Uncategorized</MenuItem>
              {categories.map((category) => (
                <MenuItem key={category.id} value={category.id}>
                  {category.name}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              label="Date"
              type="date"
              required
              value={form.spentOn}
              onChange={(e) => setForm({ ...form, spentOn: e.target.value })}
              error={Boolean(fieldErrors.spentOn)}
              helperText={fieldErrors.spentOn}
              slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: today() } }}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={busy}>
            {busy ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}
