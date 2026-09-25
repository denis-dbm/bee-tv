import RefreshIcon from '@mui/icons-material/Refresh';
import { Alert, AlertTitle, Box, Button, Stack, Typography } from '@mui/material';
import type { ReactNode } from 'react';
import { classifyError } from '@/shared/api';
import { BeeMascot } from './BeeMascot';
import { ERROR_COPY } from './errorCopy';

export interface ErrorStateProps {
  error: unknown;
  onRetry?: () => void;
  /** Inline, compact variant for sections inside a page. */
  compact?: boolean;
  /** Overrides the default title for context-specific wording. */
  title?: string;
  action?: ReactNode;
}

export function ErrorState({ error, onRetry, compact = false, title, action }: ErrorStateProps) {
  const copy = ERROR_COPY[classifyError(error)];
  const retry =
    copy.retryable && onRetry ? (
      <Button onClick={onRetry} startIcon={<RefreshIcon />} variant={compact ? 'text' : 'contained'}>
        Try again
      </Button>
    ) : null;

  if (compact) {
    return (
      <Alert severity="warning" role="alert" action={retry ?? action}>
        <AlertTitle>{title ?? copy.title}</AlertTitle>
        {copy.description}
      </Alert>
    );
  }

  return (
    <Box role="alert" sx={{ py: 6, px: 2, textAlign: 'center' }}>
      <Stack spacing={2} sx={{ alignItems: 'center', maxWidth: 520, mx: 'auto' }}>
        <BeeMascot mood={copy.mood} />
        <Typography variant="h5" component="h2">
          {title ?? copy.title}
        </Typography>
        <Typography color="text.secondary">{copy.description}</Typography>
        <Stack direction="row" spacing={1}>
          {retry}
          {action}
        </Stack>
      </Stack>
    </Box>
  );
}
