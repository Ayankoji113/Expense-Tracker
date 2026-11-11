import { createTheme } from '@mui/material/styles'

/**
 * The app is styled as a ledger: warm paper, ink, hairline rules, and one green. Three typefaces
 * with fixed jobs - a serif for headings, a sans for reading, and a monospace for every figure so
 * columns of money line up.
 */
export const fonts = {
  display: '"Fraunces", "Iowan Old Style", Georgia, serif',
  body: '"IBM Plex Sans", system-ui, -apple-system, "Segoe UI", sans-serif',
  mono: '"IBM Plex Mono", ui-monospace, "SFMono-Regular", Menlo, monospace',
}

/** Spread into sx wherever a number is shown. */
export const mono = { fontFamily: fonts.mono, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em' }

// Semantic roles, used consistently: green = income and actions, terracotta = money out or over,
// ochre = getting close to a limit.
const light = {
  mode: 'light',
  primary: { main: '#1F4D3A', contrastText: '#F7F4EC' },
  secondary: { main: '#8A5A1F' },
  success: { main: '#1F6B4A' },
  error: { main: '#B4412B' },
  warning: { main: '#A66A12' },
  info: { main: '#2F5D8A' },
  background: { default: '#F3F0E8', paper: '#FBF9F4' },
  text: { primary: '#1C1B18', secondary: '#6A665C' },
  divider: '#D9D4C7',
}

// Dark mode is its own palette, not an inversion: the same ledger read by lamplight.
const dark = {
  mode: 'dark',
  primary: { main: '#9BD0B1', contrastText: '#10231A' },
  secondary: { main: '#D9B26A' },
  success: { main: '#8CCBA6' },
  error: { main: '#E8917B' },
  warning: { main: '#E2B866' },
  info: { main: '#8DB6DB' },
  background: { default: '#111310', paper: '#181B17' },
  text: { primary: '#ECE8DC', secondary: '#9C988B' },
  divider: '#2B2F29',
}

export function createAppTheme(mode) {
  const palette = mode === 'dark' ? dark : light
  const label = {
    fontFamily: fonts.body,
    fontSize: '0.6875rem',
    fontWeight: 600,
    letterSpacing: '0.09em',
    textTransform: 'uppercase',
    lineHeight: 1.6,
  }

  return createTheme({
    palette,
    shape: { borderRadius: 6 },
    typography: {
      fontFamily: fonts.body,
      h3: { fontFamily: fonts.display, fontWeight: 500, letterSpacing: '-0.025em', lineHeight: 1.1 },
      h4: { fontFamily: fonts.display, fontWeight: 500, letterSpacing: '-0.02em', lineHeight: 1.15 },
      h5: { fontFamily: fonts.display, fontWeight: 500, letterSpacing: '-0.015em' },
      h6: { fontWeight: 600, fontSize: '1.0625rem' },
      subtitle1: { fontWeight: 600, fontSize: '0.9375rem', lineHeight: 1.4 },
      subtitle2: { fontWeight: 600 },
      overline: label,
      button: { fontWeight: 500, textTransform: 'none' },
      caption: { color: palette.text.secondary },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          // charts and tables scroll inside their own containers instead of the page
          body: { overflowX: 'hidden' },
          // keyboard users must always see where they are
          ':focus-visible': { outline: `2px solid ${palette.primary.main}`, outlineOffset: 2 },
          '::selection': { backgroundColor: palette.primary.main, color: palette.primary.contrastText },
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
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: { paddingInline: 16 },
          sizeLarge: { paddingBlock: 10 },
          outlined: { borderColor: palette.divider, color: palette.text.primary },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: { backgroundColor: palette.background.paper },
          notchedOutline: { borderColor: palette.divider },
        },
      },
      MuiDialog: {
        styleOverrides: { paper: { border: `1px solid ${palette.divider}` } },
      },
      MuiDialogTitle: {
        styleOverrides: { root: { fontFamily: fonts.display, fontWeight: 500, fontSize: '1.375rem' } },
      },
      MuiChip: { styleOverrides: { root: { borderRadius: 4, fontWeight: 500 } } },
      MuiLinearProgress: { styleOverrides: { root: { borderRadius: 2, height: 6 } } },
      MuiTableCell: {
        styleOverrides: {
          root: { borderColor: palette.divider },
          head: { ...label, color: palette.text.secondary, whiteSpace: 'nowrap' },
        },
      },
      MuiTooltip: {
        defaultProps: { arrow: true },
        styleOverrides: {
          tooltip: { backgroundColor: palette.text.primary, color: palette.background.default, fontWeight: 500 },
          arrow: { color: palette.text.primary },
        },
      },
      MuiSkeleton: { styleOverrides: { rounded: { borderRadius: 4 } } },
      MuiLink: { defaultProps: { underline: 'always' }, styleOverrides: { root: { textUnderlineOffset: 3 } } },
    },
  })
}
