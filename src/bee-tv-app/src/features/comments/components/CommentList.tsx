import { Avatar, List, ListItem, ListItemAvatar, ListItemText, Skeleton, Stack, Typography } from '@mui/material';
import { formatRelativeTime } from '@/shared/format';
import { EmptyState } from '@/shared/ui';
import type { Comment } from '../api';

export function CommentList({ comments }: { comments: Comment[] }) {
  if (comments.length === 0) {
    return <EmptyState size={90} title="No buzz yet" description="Be the first bee to share an opinion." />;
  }
  return (
    <List aria-label="Comments" disablePadding>
      {comments.map((comment) => (
        <ListItem key={comment.id} alignItems="flex-start" disableGutters>
          <ListItemAvatar>
            <Avatar sx={{ bgcolor: 'primary.main', color: 'primary.contrastText' }} aria-hidden="true">
              {comment.authorName.charAt(0).toUpperCase()}
            </Avatar>
          </ListItemAvatar>
          <ListItemText
            primary={
              <Stack direction="row" spacing={1} sx={{ alignItems: 'baseline' }}>
                <Typography component="span" sx={{ fontWeight: 600 }}>
                  {comment.authorName}
                </Typography>
                <Typography component="time" variant="caption" color="text.secondary" dateTime={comment.createdAt}>
                  {formatRelativeTime(comment.createdAt)}
                </Typography>
              </Stack>
            }
            secondary={comment.body}
            slotProps={{ secondary: { sx: { whiteSpace: 'pre-wrap', color: 'text.primary', mt: 0.5 } } }}
          />
        </ListItem>
      ))}
    </List>
  );
}

export function CommentListSkeleton() {
  return (
    <Stack spacing={2} aria-busy="true" aria-label="Loading comments">
      {[0, 1].map((key) => (
        <Stack key={key} direction="row" spacing={2}>
          <Skeleton variant="circular" width={40} height={40} />
          <Stack sx={{ flex: 1 }}>
            <Skeleton width="30%" />
            <Skeleton width="90%" />
          </Stack>
        </Stack>
      ))}
    </Stack>
  );
}
