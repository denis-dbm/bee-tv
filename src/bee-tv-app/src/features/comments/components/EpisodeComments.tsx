import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutlineOutlined';
import CloseIcon from '@mui/icons-material/Close';
import { Button, Dialog, DialogContent, DialogTitle, IconButton, useMediaQuery, useTheme } from '@mui/material';
import { useId, useState } from 'react';
import { pluralize } from '@/shared/format';
import { useEpisodeCommentCounts } from '../hooks';
import { CommentsSection } from './CommentsSection';

export interface EpisodeCommentsDialogProps {
  open: boolean;
  onClose: () => void;
  showId: string;
  episodeId: string;
  episodeTitle: string;
}

export function EpisodeCommentsDialog({ open, onClose, showId, episodeId, episodeTitle }: EpisodeCommentsDialogProps) {
  const titleId = useId();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" fullScreen={fullScreen} aria-labelledby={titleId}>
      <DialogTitle id={titleId} sx={{ pr: 7 }}>
        Comments · {episodeTitle}
      </DialogTitle>
      <IconButton aria-label="Close" onClick={onClose} sx={{ position: 'absolute', right: 8, top: 8 }}>
        <CloseIcon />
      </IconButton>
      <DialogContent dividers>
        <CommentsSection target={{ showId, episodeId }} />
      </DialogContent>
    </Dialog>
  );
}

/** Button labeled with the episode's comment count; opens the scoped comments pop-up. */
export function EpisodeCommentsButton({ showId, episodeId, episodeTitle }: Omit<EpisodeCommentsDialogProps, 'open' | 'onClose'>) {
  const [open, setOpen] = useState(false);
  const { countFor } = useEpisodeCommentCounts(showId);
  const count = countFor(episodeId);

  return (
    <>
      <Button
        size="small"
        variant="outlined"
        startIcon={<ChatBubbleOutlineIcon />}
        onClick={() => setOpen(true)}
        aria-label={`${pluralize(count, 'comment')} on ${episodeTitle}. Open comments`}
        aria-haspopup="dialog"
      >
        {count}
      </Button>
      {open && (
        <EpisodeCommentsDialog
          open={open}
          onClose={() => setOpen(false)}
          showId={showId}
          episodeId={episodeId}
          episodeTitle={episodeTitle}
        />
      )}
    </>
  );
}
