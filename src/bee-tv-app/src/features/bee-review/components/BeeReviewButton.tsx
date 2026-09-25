import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { Button } from '@mui/material';
import { useState } from 'react';
import type { ReviewTarget } from '../api';
import { MAGIC_GRADIENT } from '../reviewCopy';
import { BeeReviewDialog } from './BeeReviewDialog';

export interface BeeReviewButtonProps {
  target: ReviewTarget;
  subjectTitle: string;
  /** `hero` below the series poster, `compact` inside episode tiles. */
  variant?: 'hero' | 'compact';
}

export function BeeReviewButton({ target, subjectTitle, variant = 'hero' }: BeeReviewButtonProps) {
  const [open, setOpen] = useState(false);
  const hero = variant === 'hero';

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        startIcon={<AutoAwesomeIcon />}
        size={hero ? 'large' : 'small'}
        fullWidth={hero}
        aria-haspopup="dialog"
        aria-label={`Bee Review for ${subjectTitle}`}
        sx={{
          color: '#fff',
          fontWeight: 700,
          background: MAGIC_GRADIENT,
          backgroundSize: '200% 200%',
          transition: 'background-position 400ms, box-shadow 200ms',
          boxShadow: hero ? 3 : 0,
          '&:hover': { backgroundPosition: '100% 0', boxShadow: hero ? 6 : 2 },
          '&:focus-visible': { outline: '3px solid', outlineColor: 'secondary.main', outlineOffset: 2 },
        }}
      >
        Bee Review
      </Button>
      {open && <BeeReviewDialog open={open} onClose={() => setOpen(false)} target={target} subjectTitle={subjectTitle} />}
    </>
  );
}
