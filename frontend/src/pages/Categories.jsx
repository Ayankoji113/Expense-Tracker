import AddIcon from '@mui/icons-material/Add'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined'
import {
  Box,
  Button,
  Chip,
  IconButton,
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
import { EmptyState, ErrorState, SectionCard, TableSkeleton } from '../components/common/States.jsx'

export default function Categories() {
  const { notify } = useFeedback()
  const [categories, setCategories] = useState([])
  const [rules, setRules] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [newCategory, setNewCategory] = useState({ name: '', color: '#2563EB' })
  const [newRule, setNewRule] = useState({ keyword: '', categoryId: '' })
  const [busy, setBusy] = useState(false)
  const [deleting, setDeleting] = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    setError('')
    Promise.all([client.get('/categories'), client.get('/categories/rules')])
      .then(([categoriesResponse, rulesResponse]) => {
        setCategories(categoriesResponse.data)
        setRules(rulesResponse.data)
      })
      .catch((e) => setError(errorMessage(e, 'Could not load categories')))
      .finally(() => setLoading(false))
  }, [])

  useEffect(load, [load])

  const run = async (action, successMessage) => {
    setBusy(true)
    try {
      await action()
      notify(successMessage)
      load()
    } catch (e) {
      notify(errorMessage(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  const confirmDelete = async () => {
    const { kind, item } = deleting
    const url = kind === 'category' ? `/categories/${item.id}` : `/categories/rules/${item.id}`
    await run(() => client.delete(url), kind === 'category' ? 'Category deleted' : 'Rule deleted')
    setDeleting(null)
  }

  if (error && !loading) {
    return (
      <Paper variant="outlined" sx={{ borderRadius: 4 }}>
        <ErrorState message={error} onRetry={load} />
      </Paper>
    )
  }

  return (
    <Stack spacing={2}>
      <Box>
        <Typography variant="h5">Categories and rules</Typography>
        <Typography variant="body2" color="text.secondary">
          Categories group your spending. Rules tell the CSV importer where each transaction belongs.
        </Typography>
      </Box>

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' } }}>
        <SectionCard title="Categories" subtitle="Built-in categories are shared by everyone">
          <Stack
            component="form"
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1}
            sx={{ mb: 2 }}
            onSubmit={(event) => {
              event.preventDefault()
              run(async () => {
                await client.post('/categories', newCategory)
                setNewCategory({ name: '', color: '#2563EB' })
              }, 'Category created')
            }}
          >
            <TextField
              size="small"
              label="New category"
              required
              fullWidth
              value={newCategory.name}
              onChange={(event) => setNewCategory({ ...newCategory, name: event.target.value })}
            />
            <TextField
              size="small"
              type="color"
              label="Colour"
              value={newCategory.color}
              onChange={(event) => setNewCategory({ ...newCategory, color: event.target.value })}
              sx={{ width: { xs: '100%', sm: 92 } }}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <Button type="submit" variant="contained" startIcon={<AddIcon />} disabled={busy}>
              Add
            </Button>
          </Stack>

          {loading ? (
            <TableSkeleton rows={4} />
          ) : (
            <Stack divider={<Box sx={{ borderBottom: 1, borderColor: 'divider' }} />}>
              {categories.map((category) => (
                <Stack key={category.id} direction="row" alignItems="center" spacing={1.5} sx={{ py: 1 }}>
                  <Box
                    sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: category.color, flexShrink: 0 }}
                    aria-hidden
                  />
                  <Typography variant="body2" sx={{ flexGrow: 1 }} noWrap>
                    {category.name}
                  </Typography>
                  {category.builtIn ? (
                    <Chip size="small" label="built-in" variant="outlined" />
                  ) : (
                    <IconButton
                      size="small"
                      aria-label={`Delete ${category.name}`}
                      onClick={() => setDeleting({ kind: 'category', item: category })}
                    >
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  )}
                </Stack>
              ))}
            </Stack>
          )}
        </SectionCard>

        <SectionCard title="Auto-categorization rules" subtitle="On import, the longest matching keyword wins">
          <Stack
            component="form"
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1}
            sx={{ mb: 2 }}
            onSubmit={(event) => {
              event.preventDefault()
              run(async () => {
                await client.post('/categories/rules', newRule)
                setNewRule({ keyword: '', categoryId: '' })
              }, 'Rule created')
            }}
          >
            <TextField
              size="small"
              label="Keyword"
              required
              fullWidth
              placeholder="e.g. swiggy"
              value={newRule.keyword}
              onChange={(event) => setNewRule({ ...newRule, keyword: event.target.value })}
            />
            <TextField
              size="small"
              select
              required
              label="Category"
              value={newRule.categoryId}
              onChange={(event) => setNewRule({ ...newRule, categoryId: event.target.value })}
              sx={{ minWidth: { sm: 150 } }}
            >
              {categories.map((category) => (
                <MenuItem key={category.id} value={category.id}>
                  {category.name}
                </MenuItem>
              ))}
            </TextField>
            <Button type="submit" variant="contained" startIcon={<AddIcon />} disabled={busy}>
              Add
            </Button>
          </Stack>

          {loading ? (
            <TableSkeleton rows={4} />
          ) : rules.length === 0 ? (
            <EmptyState
              icon={AutoAwesomeIcon}
              title="No rules yet"
              description="Without rules, imported rows land in Uncategorized."
            />
          ) : (
            <Stack divider={<Box sx={{ borderBottom: 1, borderColor: 'divider' }} />}>
              {rules.map((rule) => (
                <Stack key={rule.id} direction="row" alignItems="center" spacing={1.5} sx={{ py: 1 }}>
                  <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                    <Typography variant="body2" noWrap>
                      {rule.keyword}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      → {rule.categoryName}
                    </Typography>
                  </Box>
                  <IconButton
                    size="small"
                    aria-label={`Delete rule ${rule.keyword}`}
                    onClick={() => setDeleting({ kind: 'rule', item: rule })}
                  >
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Stack>
              ))}
            </Stack>
          )}
        </SectionCard>
      </Box>

      <ConfirmDialog
        open={Boolean(deleting)}
        title={deleting?.kind === 'category' ? 'Delete this category?' : 'Delete this rule?'}
        description={
          deleting?.kind === 'category'
            ? `"${deleting?.item.name}" will be removed and its transactions become Uncategorized.`
            : `Imports will stop matching "${deleting?.item.keyword}".`
        }
        onConfirm={confirmDelete}
        onClose={() => setDeleting(null)}
      />
    </Stack>
  )
}
