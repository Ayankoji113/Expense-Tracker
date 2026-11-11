import AddIcon from '@mui/icons-material/Add'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined'
import { Box, Button, IconButton, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material'
import { useCallback, useEffect, useState } from 'react'
import client, { errorMessage } from '../api/client'
import ConfirmDialog from '../components/common/ConfirmDialog.jsx'
import { useFeedback } from '../components/common/Feedback.jsx'
import { EmptyState, ErrorState, PageHeader, SectionCard, TableSkeleton } from '../components/common/States.jsx'
import { mono } from '../theme'

const DEFAULT_COLOR = '#3D6B8E'
const rule = <Box sx={{ borderBottom: 1, borderColor: 'divider' }} />

export default function Categories() {
  const { notify } = useFeedback()
  const [categories, setCategories] = useState([])
  const [rules, setRules] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [newCategory, setNewCategory] = useState({ name: '', color: DEFAULT_COLOR })
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
      <Paper variant="outlined">
        <ErrorState message={error} onRetry={load} />
      </Paper>
    )
  }

  return (
    <Stack spacing={3}>
      <PageHeader
        eyebrow="Set up"
        title="Categories and rules"
        description="Categories group your spending. Rules tell the CSV importer where each line belongs."
      />

      <Box sx={{ display: 'grid', gap: 3, alignItems: 'start', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' } }}>
        <SectionCard title="Categories" subtitle="Built-in ones are shared by everyone" flush>
          <Stack
            component="form"
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1}
            sx={{ p: 2.5, borderBottom: 1, borderColor: 'divider' }}
            onSubmit={(event) => {
              event.preventDefault()
              run(async () => {
                await client.post('/categories', { ...newCategory, name: newCategory.name.trim() })
                setNewCategory({ name: '', color: DEFAULT_COLOR })
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
              slotProps={{ htmlInput: { maxLength: 60 } }}
            />
            <TextField
              size="small"
              type="color"
              label="Colour"
              value={newCategory.color}
              onChange={(event) => setNewCategory({ ...newCategory, color: event.target.value })}
              sx={{ width: { xs: '100%', sm: 92 }, flexShrink: 0 }}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <Button type="submit" variant="contained" startIcon={<AddIcon />} disabled={busy} sx={{ flexShrink: 0 }}>
              Add
            </Button>
          </Stack>

          {loading ? (
            <TableSkeleton rows={4} />
          ) : (
            <Stack divider={rule}>
              {categories.map((category) => (
                <Stack
                  key={category.id}
                  direction="row"
                  spacing={1.5}
                  sx={{ alignItems: 'center', px: 2.5, minHeight: 44 }}
                >
                  <Box
                    sx={{ width: 10, height: 10, borderRadius: '2px', bgcolor: category.color, flexShrink: 0 }}
                    aria-hidden
                  />
                  <Typography variant="body2" sx={{ flexGrow: 1 }} noWrap>
                    {category.name}
                  </Typography>
                  {category.builtIn ? (
                    <Typography variant="overline" color="text.secondary">
                      Built-in
                    </Typography>
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

        <SectionCard title="Import rules" subtitle="The longest matching keyword wins" flush>
          <Stack
            component="form"
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1}
            sx={{ p: 2.5, borderBottom: 1, borderColor: 'divider' }}
            onSubmit={(event) => {
              event.preventDefault()
              run(async () => {
                await client.post('/categories/rules', { ...newRule, keyword: newRule.keyword.trim() })
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
              slotProps={{ htmlInput: { maxLength: 60 } }}
            />
            <TextField
              size="small"
              select
              required
              label="Category"
              value={newRule.categoryId}
              onChange={(event) => setNewRule({ ...newRule, categoryId: event.target.value })}
              sx={{ minWidth: { sm: 160 }, flexShrink: 0 }}
            >
              {categories.map((category) => (
                <MenuItem key={category.id} value={category.id}>
                  {category.name}
                </MenuItem>
              ))}
            </TextField>
            <Button type="submit" variant="contained" startIcon={<AddIcon />} disabled={busy} sx={{ flexShrink: 0 }}>
              Add
            </Button>
          </Stack>

          {loading ? (
            <TableSkeleton rows={4} />
          ) : rules.length === 0 ? (
            <EmptyState
              title="No rules yet"
              description="Without rules, imported rows land in Uncategorized. Try “swiggy” → Dining."
            />
          ) : (
            <Stack divider={rule}>
              {rules.map((item) => (
                <Stack key={item.id} direction="row" spacing={1.5} sx={{ alignItems: 'center', px: 2.5, minHeight: 44 }}>
                  <Typography variant="body2" noWrap sx={{ ...mono, minWidth: 0 }}>
                    {item.keyword}
                  </Typography>
                  <Typography variant="caption" noWrap sx={{ flexGrow: 1 }}>
                    → {item.categoryName}
                  </Typography>
                  <IconButton
                    size="small"
                    aria-label={`Delete rule ${item.keyword}`}
                    onClick={() => setDeleting({ kind: 'rule', item })}
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
            ? `"${deleting?.item.name}" will be removed along with its budget and import rules. Its transactions become Uncategorized.`
            : `Imports will stop matching "${deleting?.item.keyword}".`
        }
        onConfirm={confirmDelete}
        onClose={() => setDeleting(null)}
      />
    </Stack>
  )
}
