import UploadFileIcon from '@mui/icons-material/UploadFile'
import {
  Alert,
  Box,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import { useState } from 'react'
import client, { errorMessage } from '../api/client'

export default function Import() {
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
    } catch (e) {
      setError(errorMessage(e, 'Import failed'))
    } finally {
      setBusy(false)
    }
  }

  const onDrop = (event) => {
    event.preventDefault()
    setDragging(false)
    const dropped = event.dataTransfer.files?.[0]
    setFile(dropped)
    upload(dropped)
  }

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
        Import a bank CSV
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Needs a header row with date, description and amount columns. Rows are categorized from your keyword rules,
        duplicates are skipped, and any bad row is reported without stopping the import.
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Paper
        variant="outlined"
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        sx={{
          p: 6,
          textAlign: 'center',
          borderStyle: 'dashed',
          borderWidth: 2,
          borderColor: dragging ? 'primary.main' : 'divider',
          bgcolor: dragging ? 'action.hover' : 'transparent',
        }}
      >
        <UploadFileIcon sx={{ fontSize: 48, color: 'text.secondary' }} />
        <Typography sx={{ my: 1 }}>{file ? file.name : 'Drop a CSV here, or'}</Typography>
        <Button variant="contained" component="label" disabled={busy}>
          {busy ? 'Importing...' : 'Choose file'}
          <input
            hidden
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => {
              const selected = e.target.files?.[0]
              setFile(selected)
              upload(selected)
            }}
          />
        </Button>
      </Paper>

      {summary && (
        <Paper variant="outlined" sx={{ mt: 3, p: 3 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>
            Import summary
          </Typography>
          <Box sx={{ display: 'flex', gap: 4, flexWrap: 'wrap', mb: 2 }}>
            <Figure label="Imported" value={summary.imported} />
            <Figure label="Duplicates skipped" value={summary.duplicates} />
            <Figure label="Rows failed" value={summary.failed} />
          </Box>
          {summary.ignoredColumns?.length > 0 && (
            <Alert severity="info" sx={{ mb: 2 }}>
              Ignored columns: {summary.ignoredColumns.join(', ')}
            </Alert>
          )}
          {summary.rowErrors?.length > 0 && (
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
          )}
        </Paper>
      )}
    </Box>
  )
}

function Figure({ label, value }) {
  return (
    <Box>
      <Typography variant="h4" sx={{ fontWeight: 700 }}>
        {value}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
    </Box>
  )
}
