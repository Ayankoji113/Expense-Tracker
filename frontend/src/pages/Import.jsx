import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutlineOutlined'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  LinearProgress,
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
import { SectionCard } from '../components/common/States.jsx'

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
    if (!selected) return
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
      setError(errorMessage(e, 'Import failed'))
    } finally {
      setBusy(false)
    }
  }

  const pick = (selected) => {
    setFile(selected)
    upload(selected)
  }

  return (
    <Stack spacing={2}>
      <Box>
        <Typography variant="h5">Import a bank CSV</Typography>
        <Typography variant="body2" color="text.secondary">
          Rows are categorised from your keyword rules, duplicates are skipped, and any bad row is reported
          without stopping the import.
        </Typography>
      </Box>

      {error && <Alert severity="error">{error}</Alert>}

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '3fr 2fr' } }}>
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
            pick(event.dataTransfer.files?.[0])
          }}
          sx={{
            borderRadius: 4,
            borderStyle: 'dashed',
            borderWidth: 2,
            borderColor: dragging ? 'primary.main' : 'divider',
            bgcolor: (theme) => (dragging ? alpha(theme.palette.primary.main, 0.06) : 'transparent'),
            p: { xs: 4, md: 6 },
            textAlign: 'center',
            transition: 'border-color 150ms ease, background-color 150ms ease',
          }}
        >
          {busy ? (
            <Stack alignItems="center" spacing={2}>
              <CircularProgress size={36} />
              <Typography variant="body2" color="text.secondary">
                Importing {file?.name}...
              </Typography>
              <LinearProgress sx={{ width: '60%' }} />
            </Stack>
          ) : (
            <Stack alignItems="center" spacing={1.5}>
              <Box
                aria-hidden
                sx={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  display: 'grid',
                  placeItems: 'center',
                  color: 'primary.main',
                  bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1),
                }}
              >
                <UploadFileIcon />
              </Box>
              <Typography variant="subtitle1">{file ? file.name : 'Drop your CSV here'}</Typography>
              <Typography variant="body2" color="text.secondary">
                or choose a file from your computer
              </Typography>
              <Button variant="contained" component="label">
                Choose file
                <input
                  hidden
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(event) => pick(event.target.files?.[0])}
                />
              </Button>
            </Stack>
          )}
        </Paper>

        <SectionCard title="Expected format" subtitle="Column order does not matter">
          <Paper
            variant="outlined"
            sx={{
              p: 1.5,
              borderRadius: 2,
              bgcolor: 'action.hover',
              overflowX: 'auto',
            }}
          >
            <Typography component="pre" variant="caption" sx={{ m: 0, fontFamily: 'monospace' }}>
              {SAMPLE}
            </Typography>
          </Paper>
          <Button
            size="small"
            startIcon={<ContentCopyIcon />}
            sx={{ mt: 1.5 }}
            onClick={() => {
              navigator.clipboard?.writeText(SAMPLE)
              notify('Sample copied to clipboard')
            }}
          >
            Copy sample
          </Button>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
            Needs date, description and amount columns. Extra columns are ignored and reported back.
            Set up <Link to="/categories">keyword rules</Link> first so rows land in the right category.
          </Typography>
        </SectionCard>
      </Box>

      {summary && (
        <SectionCard
          title="Import summary"
          action={
            <Button component={Link} to="/transactions" size="small">
              View transactions
            </Button>
          }
        >
          <Box
            sx={{
              display: 'grid',
              gap: 2,
              gridTemplateColumns: { xs: 'repeat(3, 1fr)' },
              mb: summary.rowErrors?.length || summary.ignoredColumns?.length ? 2 : 0,
            }}
          >
            <Figure tone="success" icon={CheckCircleIcon} label="Imported" value={summary.imported} />
            <Figure tone="warning" label="Duplicates skipped" value={summary.duplicates} />
            <Figure tone="error" icon={summary.failed ? ErrorOutlineIcon : undefined} label="Rows failed" value={summary.failed} />
          </Box>

          {summary.ignoredColumns?.length > 0 && (
            <Alert severity="info" sx={{ mb: 2 }}>
              Ignored columns: {summary.ignoredColumns.join(', ')}
            </Alert>
          )}

          {summary.rowErrors?.length > 0 && (
            <TableContainer sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Row</TableCell>
                    <TableCell>Problem</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {summary.rowErrors.map((rowError) => (
                    <TableRow key={rowError.row}>
                      <TableCell>{rowError.row}</TableCell>
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

function Figure({ tone, icon: Icon, label, value }) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        borderRadius: 3,
        borderColor: (theme) => alpha(theme.palette[tone].main, 0.3),
        bgcolor: (theme) => alpha(theme.palette[tone].main, theme.palette.mode === 'dark' ? 0.12 : 0.06),
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center">
        {Icon && <Icon fontSize="small" color={tone} />}
        <Typography variant="h5" color={`${tone}.main`}>
          {value}
        </Typography>
      </Stack>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
    </Paper>
  )
}
