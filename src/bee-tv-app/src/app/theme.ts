import { createTheme } from '@mui/material';

const HONEY = '#FFB300';
/** Honey tone dark enough for text on light backgrounds (WCAG AA, ~6.8:1 on white). */
const HONEY_TEXT = '#7A4F00';

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: HONEY, dark: HONEY_TEXT, contrastText: '#1b1b1b' },
    secondary: { main: '#7B1FA2' },
    background: { default: '#FFFBF2', paper: '#FFFFFF' },
    text: { primary: '#1b1b1b', secondary: '#5f5a50' },
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: '"Inter", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    button: { textTransform: 'none', fontWeight: 600 },
  },
  components: {
    MuiCard: { defaultProps: { elevation: 1 } },
    MuiLink: { defaultProps: { underline: 'hover', color: 'primary.dark' } },
    // Honey is a fill color: when primary is used as *text*, switch to the accessible tone.
    MuiButton: {
      variants: [
        { props: { variant: 'text', color: 'primary' }, style: { color: HONEY_TEXT } },
        { props: { variant: 'outlined', color: 'primary' }, style: { color: HONEY_TEXT, borderColor: '#C98A00' } },
      ],
    },
    MuiChip: {
      variants: [{ props: { variant: 'outlined', color: 'primary' }, style: { color: HONEY_TEXT, borderColor: '#C98A00' } }],
    },
    MuiTab: { styleOverrides: { root: { '&.Mui-selected': { color: HONEY_TEXT } } } },
  },
});
