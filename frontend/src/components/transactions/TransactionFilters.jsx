import SearchIcon from '@mui/icons-material/Search'
import { Box, Button, InputAdornment, MenuItem, Paper, TextField } from '@mui/material'

const EMPTY = { q: '', kind: '', categoryId: '', from: '', to: '' }

export const EMPTY_FILTERS = EMPTY

export default function TransactionFilters({ filters, categories, onChange }) {
  const set = (patch) => onChange({ ...filters, ...patch })
  const dirty = Object.keys(EMPTY).some((key) => filters[key])

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        mb: 2,
        borderRadius: 4,
        display: 'grid',
        gap: 1.5,
        gridTemplateColumns: {
          xs: '1fr',
          sm: 'repeat(2, 1fr)',
          md: 'minmax(180px, 1.4fr) repeat(3, 1fr) auto',
        },
      }}
    >
      <TextField
        size="small"
        label="Search"
        placeholder="Description contains..."
        value={filters.q}
        onChange={(e) => set({ q: e.target.value })}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          },
        }}
      />
      <TextField size="small" select label="Type" value={filters.kind} onChange={(e) => set({ kind: e.target.value })}>
        <MenuItem value="">All</MenuItem>
        <MenuItem value="EXPENSE">Expense</MenuItem>
        <MenuItem value="INCOME">Income</MenuItem>
      </TextField>
      <TextField
        size="small"
        select
        label="Category"
        value={filters.categoryId}
        onChange={(e) => set({ categoryId: e.target.value })}
      >
        <MenuItem value="">All</MenuItem>
        {categories.map((category) => (
          <MenuItem key={category.id} value={category.id}>
            {category.name}
          </MenuItem>
        ))}
      </TextField>
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
        <TextField
          size="small"
          label="From"
          type="date"
          value={filters.from}
          onChange={(e) => set({ from: e.target.value })}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <TextField
          size="small"
          label="To"
          type="date"
          value={filters.to}
          onChange={(e) => set({ to: e.target.value })}
          slotProps={{ inputLabel: { shrink: true } }}
        />
      </Box>
      <Button onClick={() => onChange({ ...EMPTY })} disabled={!dirty} sx={{ justifySelf: 'start' }}>
        Clear
      </Button>
    </Paper>
  )
}
