import UploadFileIcon from '@mui/icons-material/UploadFileOutlined'
import {
  Alert,
  Box,
  Button,
  LinearProgress,
  Link as MuiLink,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import { alpha } from '@mui/material/styles'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import client, { errorMessage } from '../api/client'
import { useFeedback } from '../components/common/Feedback.jsx'
import { PageHeader, SectionCard } from '../components/common/States.jsx'
import StatCard, { StatStrip } from '../components/dashboard/StatCard.jsx'
import { mono } from '../theme'

const SAMPLE = `Date,Description,Amount
2026-08-01,BIG BAZAAR GROCERIES,2450
2026-08-03,UBER TRIP 4821,320
2026-08-05,RENT AUGUST,25000`

export default function Import() {
  const { notify } = useFeedback()
  const [file, setFile] = useState(null)
  const [summary, setSummary] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)

  const upload = async (selected) => {
    if (!selected || busy) return
    setFile(selected)
    setBusy(true)
    setError('')
    setSummary(null)
    const body = new FormData()
    body.append('file', selected)
    try {
      const { data } = await client.post('/expenses/import', body)
      setSummary(data)
      notify(`${data.imported} ${data.imported === 1 ? 'transaction' : 'transactions'} imported`)
    } catch (e) {
      setError(
        e.response?.status === 413
          ? 'That file is larger than 5 MB. Split it and import the parts.'
          : errorMessage(e, 'Import failed'),
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <Stack spacing={3}>
      <PageHeader
        eyebrow="Set up"
        title="Import a bank CSV"
        description="Rows are categorised from your keyword rules, duplicates are skipped, and a bad row is reported without stopping the rest."
      />

      {error && <Alert severity="error">{error}</Alert>}

      <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', md: '3fr 2fr' } }}>
        <Paper
          variant="outlined"
          onDragOver={(event) => {
            event.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault()
            setDragging(false)
            upload(event.dataTransfer.files?.[0])
          }}
          sx={{
            display: 'grid',
            placeItems: 'center',
            minHeight: 280,
            p: { xs: 3, md: 5 },
            textAlign: 'center',
            borderStyle: 'dashed',
            borderColor: dragging ? 'primary.main' : 'text.secondary',
            bgcolor: (theme) => (dragging ? alpha(theme.palette.primary.main, 0.06) : 'transparent'),
            transition: 'border-color 150ms ease, background-color 150ms ease',
          }}
        >
          {busy ? (
            <Stack spacing={2} sx={{ alignItems: 'center', width: '100%' }}>
              <Typography variant="body2" color="text.secondary">
                Importing {file?.name}...
              </Typography>
              <LinearProgress sx={{ width: '60%', maxWidth: 280 }} />
            </Stack>
          ) : (
            <Stack spacing={1.25} sx={{ alignItems: 'center' }}>
              <UploadFileIcon sx={{ fontSize: 32, color: 'text.secondary' }} aria-hidden />
              <Typography variant="h5" component="p">
                {file ? file.name : 'Drop your statement here'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {file ? 'Drop another file, or choose one to import again.' : 'A .csv file, up to 5 MB and 10,000 rows.'}
              </Typography>
              <Button variant="contained" component="label" sx={{ mt: 1 }}>
                Choose file
                <input
                  hidden
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(event) => {
                    upload(event.target.files?.[0])
                    // without this, picking the same file again does not fire a change event
                    event.target.value = ''
                  }}
                />
              </Button>
            </Stack>
          )}
        </Paper>

        <SectionCard title="Expected format" subtitle="Column order does not matter">
          <Box
            component="pre"
            sx={{
              ...mono,
              m: 0,
              p: 1.5,
              fontSize: '0.75rem',
              lineHeight: 1.7,
              borderRadius: 1,
              bgcolor: 'action.hover',
              overflowX: 'auto',
            }}
          >
            {SAMPLE}
          </Box>
          <Button
            size="small"
            variant="outlined"
            sx={{ mt: 1.5 }}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(SAMPLE)
                notify('Sample copied to clipboard')
              } catch {
                notify('Could not copy. Select the text and copy it by hand.', 'error')
              }
            }}
          >
            Copy sample
          </Button>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            Needs date, description and amount columns. Extra columns are ignored and reported back. Set up{' '}
            <MuiLink component={Link} to="/categories">
              keyword rules
            </MuiLink>{' '}
            first so rows land in the right category.
          </Typography>
        </SectionCard>
      </Box>

      {summary && (
        <SectionCard
          title="Import summary"
          subtitle={file?.name}
          flush
          action={
            <Button component={Link} to="/transactions" size="small" color="inherit" sx={{ color: 'text.secondary', mr: -1 }}>
              View transactions
            </Button>
          }
        >
          <Box sx={{ '& > *': { border: 0, borderRadius: 0 } }}>
            <StatStrip columns={3}>
              <StatCard label="Imported" value={summary.imported} tone={summary.imported ? 'success' : undefined} caption="New transactions" />
              <StatCard label="Duplicates" value={summary.duplicates} caption="Already in your ledger, skipped" />
              <StatCard label="Failed" value={summary.failed} tone={summary.failed ? 'error' : undefined} caption="Rows that could not be read" />
            </StatStrip>
          </Box>

          {summary.ignoredColumns?.length > 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ px: 2.5, py: 1.5, borderTop: 1, borderColor: 'divider' }}>
              Ignored columns: {summary.ignoredColumns.join(', ')}
            </Typography>
          )}

          {summary.rowErrors?.length > 0 && (
            <TableContainer sx={{ overflowX: 'auto', borderTop: 1, borderColor: 'divider' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ width: 80 }}>Line</TableCell>
                    <TableCell>Problem</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {summary.rowErrors.map((rowError) => (
                    <TableRow key={rowError.row} sx={{ '&:last-child td': { borderBottom: 0 } }}>
                      <TableCell sx={mono}>{rowError.row}</TableCell>
                      <TableCell>{rowError.message}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </SectionCard>
      )}
    </Stack>
  )
}
