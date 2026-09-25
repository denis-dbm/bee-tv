import LiveTvIcon from '@mui/icons-material/LiveTv';
import { Box, type SxProps, type Theme } from '@mui/material';

export function PosterPlaceholder({ sx }: { sx?: SxProps<Theme> }) {
  return (
    <Box
      aria-hidden="true"
      sx={[
        {
          aspectRatio: '2 / 3',
          display: 'grid',
          placeItems: 'center',
          bgcolor: 'action.hover',
          color: 'text.disabled',
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      <LiveTvIcon sx={{ fontSize: 56 }} />
    </Box>
  );
}
