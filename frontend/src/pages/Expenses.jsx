import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Paper,
  TextField,
  Typography,
} from '@mui/material'
import { DataGrid } from '@mui/x-data-grid'
import { useCallback, useEffect, useState } from 'react'
import client, { errorMessage } from '../api/client'

const EMPTY = { amount: '', spentOn: new Date().toISOString().slice(0, 10), description: '', categoryId: '' }

export default function Expenses() {
  const [rows, setRows] = useState([])
  const [rowCount, setRowCount] = useState(0)
  const [categories, setCategories] = useState([])
  const [filters, setFilters] = useState({ from: '', to: '', categoryId: '', q: '' })
  const [pagination, setPagination] = useState({ page: 0, pageSize: 25 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(null)

  const load = useCallback(() => {
    const params = { page: pagination.page, size: pagination.pageSize }
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params[key] = value
    })
    setLoading(true)
    client
      .get('/expenses', { params })
      .then(({ data }) => {
        setRows(data.content)
        setRowCount(data.totalElements)
      })
      .catch((e) => setError(errorMessage(e, 'Could not load expenses')))
      .finally(() => setLoading(false))
  }, [filters, pagination])

  useEffect(load, [load])
  useEffect(() => {
    client.get('/categories').then(({ data }) => setCategories(data)).catch(() => setCategories([]))
  }, [])

  const remove = async (id) => {
    setError('')
    try {
      await client.delete(`/expenses/${id}`)
      load()
    } catch (e) {
      setError(errorMessage(e, 'Could not delete expense'))
    }
  }

  const columns = [
    { field: 'spentOn', headerName: 'Date', width: 120 },
    { field: 'description', headerName: 'Description', flex: 1, minWidth: 200 },
    {
      field: 'categoryName',
      headerName: 'Category',
      width: 160,
      renderCell: ({ row }) => (
        <Chip size="small" label={row.categoryName} sx={{ bgcolor: row.categoryColor, color: '#fff' }} />
      ),
    },
    {
      field: 'amount',
      headerName: 'Amount',
      width: 120,
      type: 'number',
      valueFormatter: (value) => Number(value).toFixed(2),
    },
    { field: 'source', headerName: 'Source', width: 100 },
    {
      field: 'actions',
      headerName: '',
      width: 100,
      sortable: false,
      renderCell: ({ row }) => (
        <>
          <IconButton size="small" aria-label="edit" onClick={() => setEditing({ ...row, categoryId: row.categoryId ?? '' })}>
            <EditIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" aria-label="delete" onClick={() => remove(row.id)}>
            <DeleteIcon fontSize="small" />
          </IconButton>
        </>
      ),
    },
  ]

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 2, flexWrap: 'wrap' }}>
        <Typography variant="h5" sx={{ fontWeight: 700, flexGrow: 1 }}>
          Expenses
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setEditing({ ...EMPTY })}>
          Add expense
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Paper variant="outlined" sx={{ p: 2, mb: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <TextField
          label="From"
          type="date"
          size="small"
          slotProps={{ inputLabel: { shrink: true } }}
          value={filters.from}
          onChange={(e) => setFilters({ ...filters, from: e.target.value })}
        />
        <TextField
          label="To"
          type="date"
          size="small"
          slotProps={{ inputLabel: { shrink: true } }}
          value={filters.to}
          onChange={(e) => setFilters({ ...filters, to: e.target.value })}
        />
        <TextField
          select
          label="Category"
          size="small"
          sx={{ minWidth: 160 }}
          value={filters.categoryId}
          onChange={(e) => setFilters({ ...filters, categoryId: e.target.value })}
        >
          <MenuItem value="">All</MenuItem>
          {categories.map((c) => (
            <MenuItem key={c.id} value={c.id}>
              {c.name}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          label="Search description"
          size="small"
          value={filters.q}
          onChange={(e) => setFilters({ ...filters, q: e.target.value })}
        />
      </Paper>

      <Paper variant="outlined">
        <DataGrid
          rows={rows}
          columns={columns}
          loading={loading}
          rowCount={rowCount}
          paginationMode="server"
          paginationModel={pagination}
          onPaginationModelChange={setPagination}
          pageSizeOptions={[10, 25, 50]}
          disableRowSelectionOnClick
          autoHeight
        />
      </Paper>

      <ExpenseDialog
        expense={editing}
        categories={categories}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null)
          load()
        }}
      />
    </Box>
  )
}

function ExpenseDialog({ expense, categories, onClose, onSaved }) {
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (expense) {
      setForm({
        amount: expense.amount ?? '',
        spentOn: expense.spentOn ?? EMPTY.spentOn,
        description: expense.description ?? '',
        categoryId: expense.categoryId ?? '',
      })
      setError('')
    }
  }, [expense])

  if (!expense) return null

  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    const payload = { ...form, amount: Number(form.amount), categoryId: form.categoryId || null }
    try {
      if (expense.id) await client.put(`/expenses/${expense.id}`, payload)
      else await client.post('/expenses', payload)
      onSaved()
    } catch (e) {
      setError(errorMessage(e, 'Could not save expense'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <form onSubmit={submit}>
        <DialogTitle>{expense.id ? 'Edit expense' : 'Add expense'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            label="Amount"
            type="number"
            required
            inputProps={{ step: '0.01', min: '0.01' }}
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
          />
          <TextField
            label="Date"
            type="date"
            required
            slotProps={{ inputLabel: { shrink: true } }}
            value={form.spentOn}
            onChange={(e) => setForm({ ...form, spentOn: e.target.value })}
          />
          <TextField
            label="Description"
            required
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <TextField
            select
            label="Category"
            value={form.categoryId}
            onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
          >
            <MenuItem value="">Uncategorized</MenuItem>
            {categories.map((c) => (
              <MenuItem key={c.id} value={c.id}>
                {c.name}
              </MenuItem>
            ))}
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={busy}>
            Save
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}
