import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CloseIcon from '@mui/icons-material/Close';
import PsychologyAltIcon from '@mui/icons-material/PsychologyAlt';
import {
  Box,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  Skeleton,
  Stack,
  Switch,
  Tooltip,
  Typography,
} from '@mui/material';
import { useId, useState } from 'react';
import { pluralize } from '@/shared/format';
import { ErrorState } from '@/shared/ui';
import type { BeeReview, ReviewTarget } from '../api';
import { SOURCE_COPY } from '../reviewCopy';
import { useBeeReview } from '../useBeeReview';

function ReviewBody({ review }: { review: BeeReview }) {
  const copy = SOURCE_COPY[review.source];
  return (
    <Stack spacing={2}>
      <Typography
        component="blockquote"
        sx={{ m: 0, pl: 2, borderLeft: 4, borderColor: 'primary.main', fontSize: '1.1rem', lineHeight: 1.7 }}
      >
        {review.text}
      </Typography>
      <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
        <Tooltip title={copy.hint}>
          <Chip
            size="small"
            icon={review.source === 'ai' ? <AutoAwesomeIcon /> : <PsychologyAltIcon />}
            label={copy.label}
            color={review.source === 'ai' ? 'secondary' : 'default'}
            variant={review.source === 'ai' ? 'filled' : 'outlined'}
          />
        </Tooltip>
        {review.commentsConsidered > 0 && (
          <Typography variant="caption" color="text.secondary">
            Based on {pluralize(review.commentsConsidered, 'viewer comment')}
          </Typography>
        )}
      </Stack>
      {review.source === 'fallback' && (
        <Typography variant="caption" color="text.secondary">
          {copy.hint}
        </Typography>
      )}
    </Stack>
  );
}

function ReviewLoading() {
  return (
    <Stack spacing={1} aria-busy="true">
      <Typography color="text.secondary">Bee is watching closely…</Typography>
      <Skeleton />
      <Skeleton />
      <Skeleton width="70%" />
    </Stack>
  );
}

export interface BeeReviewDialogProps {
  open: boolean;
  onClose: () => void;
  target: ReviewTarget;
  subjectTitle: string;
}

export function BeeReviewDialog({ open, onClose, target, subjectTitle }: BeeReviewDialogProps) {
  const [includeComments, setIncludeComments] = useState(false);
  const { data, error, isPending, isError, refetch } = useBeeReview(target, includeComments, open);
  const titleId = useId();

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" aria-labelledby={titleId}>
      <DialogTitle id={titleId} sx={{ pr: 7 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <AutoAwesomeIcon sx={{ color: 'primary.main' }} aria-hidden="true" />
          <span>Bee Review · {subjectTitle}</span>
        </Stack>
      </DialogTitle>
      <IconButton aria-label="Close" onClick={onClose} sx={{ position: 'absolute', right: 8, top: 8 }}>
        <CloseIcon />
      </IconButton>
      <DialogContent dividers>
        <Stack spacing={2}>
          <FormControlLabel
            control={<Switch color="secondary" checked={includeComments} onChange={(event) => setIncludeComments(event.target.checked)} />}
            label="Consider viewers' opinions"
          />
          <Box aria-live="polite">
            {isPending && <ReviewLoading />}
            {isError && <ErrorState compact error={error} onRetry={() => void refetch()} title="Bee couldn't review this one" />}
            {data && <ReviewBody review={data} />}
          </Box>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
