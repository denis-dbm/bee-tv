import { Box, Button, Stack, TextField } from '@mui/material';
import { type FormEvent, type KeyboardEvent, useId, useState } from 'react';
import { MAX_COMMENT_LENGTH } from '../api';

export interface CommentFormProps {
  onSubmit: (body: string) => Promise<unknown>;
  isSubmitting: boolean;
  label?: string;
}

export function CommentForm({ onSubmit, isSubmitting, label = 'Share your thoughts' }: CommentFormProps) {
  const [body, setBody] = useState('');
  const helperId = useId();
  const trimmed = body.trim();
  const canSubmit = trimmed.length > 0 && !isSubmitting;

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!canSubmit) return;
    try {
      await onSubmit(trimmed);
      setBody('');
    } catch {
      // The caller reports the failure; keep the draft so nothing is lost.
    }
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) void submit();
  };

  return (
    <Box component="form" onSubmit={(event) => void submit(event)} noValidate>
      <Stack spacing={1}>
        <TextField
          label={label}
          placeholder="What did you think? (Ctrl + Enter to send)"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          onKeyDown={onKeyDown}
          multiline
          minRows={3}
          fullWidth
          slotProps={{ htmlInput: { maxLength: MAX_COMMENT_LENGTH, 'aria-describedby': helperId } }}
          helperText={<span id={helperId}>{`${body.length}/${MAX_COMMENT_LENGTH}`}</span>}
        />
        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button type="submit" variant="contained" disabled={!canSubmit} loading={isSubmitting}>
            Comment
          </Button>
        </Box>
      </Stack>
    </Box>
  );
}
