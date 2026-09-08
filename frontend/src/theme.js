import { createTheme } from '@mui/material/styles'

/**
 * One place for every colour in the app. Semantic roles, used consistently:
 * blue = actions/navigation, green = income, red = expense, amber = budget warning,
 * purple = analytics accents.
 */
const brand = {
  primary: '#2563EB',
  secondary: '#7C3AED',
  success: '#16A34A',
  error: '#DC2626',
  warning: '#D97706',
  info: '#0284C7',
}

const light = {
  mode: 'light',
  ...Object.fromEntries(Object.entries(brand).map(([key, main]) => [key, { main }])),
  background: { default: '#F8FAFC', paper: '#FFFFFF' },
  text: { primary: '#0F172A', secondary: '#64748B' },
  divider: '#E2E8F0',
}

// Dark mode is its own palette, not an inversion: lifted surfaces, softened accents.
const dark = {
  mode: 'dark',
  primary: { main: '#60A5FA' },
  secondary: { main: '#A78BFA' },
  success: { main: '#4ADE80' },
  error: { main: '#F87171' },
  warning: { main: '#FBBF24' },
  info: { main: '#38BDF8' },
  background: { default: '#0B1120', paper: '#111827' },
  text: { primary: '#F1F5F9', secondary: '#94A3B8' },
  divider: '#1E293B',
}

export function createAppTheme(mode) {
  const palette = mode === 'dark' ? dark : light

  return createTheme({
    palette,
    shape: { borderRadius: 12 },
    typography: {
      fontFamily: '"Inter", "Roboto", system-ui, -apple-system, sans-serif',
      h4: { fontWeight: 700, letterSpacing: '-0.02em' },
      h5: { fontWeight: 700, letterSpacing: '-0.01em' },
      h6: { fontWeight: 600 },
      subtitle1: { fontWeight: 600 },
      subtitle2: { fontWeight: 600 },
      button: { fontWeight: 600, textTransform: 'none' },
      caption: { color: palette.text.secondary },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          // charts and tables scroll inside their own containers instead of the page
          body: { overflowX: 'hidden' },
          '@media (prefers-reduced-motion: reduce)': {
            '*': { animationDuration: '0.01ms !important', transitionDuration: '0.01ms !important' },
          },
        },
      },
      MuiPaper: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: { backgroundImage: 'none' },
          outlined: { borderColor: palette.divider },
        },
      },
      MuiCard: {
        defaultProps: { variant: 'outlined' },
        styleOverrides: {
          root: {
            borderRadius: 16,
            borderColor: palette.divider,
            transition: 'box-shadow 160ms ease, transform 160ms ease',
          },
        },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: { root: { borderRadius: 10, paddingInline: 16 } },
      },
      MuiOutlinedInput: { styleOverrides: { root: { borderRadius: 10 } } },
      MuiChip: { styleOverrides: { root: { fontWeight: 600 } } },
      MuiLinearProgress: { styleOverrides: { root: { borderRadius: 999, height: 8 } } },
      MuiTableCell: {
        styleOverrides: {
          root: { borderColor: palette.divider },
          head: { fontWeight: 600, color: palette.text.secondary, whiteSpace: 'nowrap' },
        },
      },
      MuiTooltip: { defaultProps: { arrow: true } },
    },
  })
}
