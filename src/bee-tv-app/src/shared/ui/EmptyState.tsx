import { Box, Stack, Typography } from '@mui/material';
import type { ReactNode } from 'react';
import { BeeMascot, type BeeMood } from './BeeMascot';

export interface EmptyStateProps {
  title: string;
  description?: ReactNode;
  mood?: BeeMood;
  size?: number;
}

export function EmptyState({ title, description, mood = 'happy', size = 120 }: EmptyStateProps) {
  return (
    <Box sx={{ py: 5, px: 2, textAlign: 'center' }}>
      <Stack spacing={1.5} sx={{ alignItems: 'center', maxWidth: 480, mx: 'auto' }}>
        <BeeMascot mood={mood} size={size} />
        <Typography variant="h6" component="p">
          {title}
        </Typography>
        {description && <Typography color="text.secondary">{description}</Typography>}
      </Stack>
    </Box>
  );
}
