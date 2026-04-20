import { createTheme } from '@mui/material/styles'

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1b5e20',
      light: '#4c8c4a',
      dark: '#003300',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#ef6c00',
      light: '#ff9d3f',
      dark: '#b53d00',
      contrastText: '#ffffff',
    },
    background: {
      default: '#f6f7f9',
      paper: '#ffffff',
    },
    success: { main: '#2e7d32' },
    warning: { main: '#ed6c02' },
    error: { main: '#c62828' },
    info: { main: '#0277bd' },
  },
  shape: {
    borderRadius: 10,
  },
  typography: {
    fontFamily: '"Roboto","Segoe UI",system-ui,sans-serif',
    h1: { fontWeight: 500, fontSize: '2.25rem', letterSpacing: '-0.01em' },
    h2: { fontWeight: 500, fontSize: '1.75rem' },
    h3: { fontWeight: 500, fontSize: '1.375rem' },
    h4: { fontWeight: 500, fontSize: '1.125rem' },
    h5: { fontWeight: 500 },
    h6: { fontWeight: 500 },
    button: { textTransform: 'none', fontWeight: 500 },
  },
  components: {
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
    MuiCard: {
      defaultProps: { variant: 'outlined' },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { borderRadius: 8 },
      },
    },
    MuiAppBar: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: ({ theme }) => ({
          borderBottom: `1px solid ${theme.palette.divider}`,
        }),
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: { fontWeight: 600 },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: { textTransform: 'none', fontWeight: 500, minHeight: 48 },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 500 },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: { fontSize: 12 },
      },
    },
  },
})
