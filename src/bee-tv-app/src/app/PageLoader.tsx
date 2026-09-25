import { Box, CircularProgress } from '@mui/material';

export function PageLoader() {
  return (
    <Box sx={{ minHeight: '60vh', display: 'grid', placeItems: 'center' }}>
      <CircularProgress aria-label="Loading page" />
    </Box>
  );
}
