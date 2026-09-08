import DeleteIcon from '@mui/icons-material/Delete'
import {
  Alert,
  Box,
  Button,
  Chip,
  IconButton,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Paper,
  TextField,
  Typography,
} from '@mui/material'
import { useCallback, useEffect, useState } from 'react'
import client, { errorMessage } from '../api/client'

export default function Categories() {
  const [categories, setCategories] = useState([])
  const [rules, setRules] = useState([])
  const [error, setError] = useState('')
  const [newCategory, setNewCategory] = useState({ name: '', color: '#1565c0' })
  const [newRule, setNewRule] = useState({ keyword: '', categoryId: '' })

  const load = useCallback(() => {
    Promise.all([client.get('/categories'), client.get('/categories/rules')])
      .then(([c, r]) => {
        setCategories(c.data)
        setRules(r.data)
      })
      .catch((e) => setError(errorMessage(e, 'Could not load categories')))
  }, [])

  useEffect(load, [load])

  const run = async (action) => {
    setError('')
    try {
      await action()
      load()
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>
        Categories and rules
      </Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            Categories
          </Typography>
          <Box
            component="form"
            sx={{ display: 'flex', gap: 1, my: 2 }}
            onSubmit={(e) => {
              e.preventDefault()
              run(async () => {
                await client.post('/categories', newCategory)
                setNewCategory({ name: '', color: '#1565c0' })
              })
            }}
          >
            <TextField
              size="small"
              label="New category"
              required
              value={newCategory.name}
              onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
            />
            <TextField
              size="small"
              type="color"
              sx={{ width: 70 }}
              value={newCategory.color}
              onChange={(e) => setNewCategory({ ...newCategory, color: e.target.value })}
            />
            <Button type="submit" variant="contained">
              Add
            </Button>
          </Box>
          <List dense>
            {categories.map((category) => (
              <ListItem
                key={category.id}
                secondaryAction={
                  category.builtIn ? (
                    <Chip size="small" label="built-in" />
                  ) : (
                    <IconButton
                      edge="end"
                      aria-label={`delete ${category.name}`}
                      onClick={() => run(() => client.delete(`/categories/${category.id}`))}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  )
                }
              >
                <Box sx={{ width: 14, height: 14, borderRadius: '50%', bgcolor: category.color, mr: 1.5 }} />
                <ListItemText primary={category.name} />
              </ListItem>
            ))}
          </List>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            Auto-categorization rules
          </Typography>
          <Typography variant="body2" color="text.secondary">
            On import, the longest keyword found in a description wins.
          </Typography>
          <Box
            component="form"
            sx={{ display: 'flex', gap: 1, my: 2 }}
            onSubmit={(e) => {
              e.preventDefault()
              run(async () => {
                await client.post('/categories/rules', newRule)
                setNewRule({ keyword: '', categoryId: '' })
              })
            }}
          >
            <TextField
              size="small"
              label="Keyword"
              required
              value={newRule.keyword}
              onChange={(e) => setNewRule({ ...newRule, keyword: e.target.value })}
            />
            <TextField
              select
              size="small"
              label="Category"
              required
              sx={{ minWidth: 150 }}
              value={newRule.categoryId}
              onChange={(e) => setNewRule({ ...newRule, categoryId: e.target.value })}
            >
              {categories.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.name}
                </MenuItem>
              ))}
            </TextField>
            <Button type="submit" variant="contained">
              Add
            </Button>
          </Box>
          <List dense>
            {rules.map((rule) => (
              <ListItem
                key={rule.id}
                secondaryAction={
                  <IconButton
                    edge="end"
                    aria-label={`delete rule ${rule.keyword}`}
                    onClick={() => run(() => client.delete(`/categories/rules/${rule.id}`))}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                }
              >
                <ListItemText primary={rule.keyword} secondary={rule.categoryName} />
              </ListItem>
            ))}
            {rules.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ p: 1 }}>
                No rules yet. Everything imports as Uncategorized.
              </Typography>
            )}
          </List>
        </Paper>
      </Box>
    </Box>
  )
}
