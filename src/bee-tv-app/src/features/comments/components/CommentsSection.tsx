import { Box, Divider, Stack, Typography } from '@mui/material';
import { friendlyErrorMessage, ErrorState, useNotify } from '@/shared/ui';
import type { CommentTarget } from '../api';
import { useComments, useCreateComment } from '../hooks';
import { CommentForm } from './CommentForm';
import { CommentList, CommentListSkeleton } from './CommentList';

export interface CommentsSectionProps {
  target: CommentTarget;
  heading?: string;
}

/** Form, separator and list, scoped to a series or an episode. */
export function CommentsSection({ target, heading }: CommentsSectionProps) {
  const { data, error, isPending, isError, refetch } = useComments(target);
  const createComment = useCreateComment(target);
  const notify = useNotify();
  const headingId = `comments-heading-${target.episodeId ?? 'series'}`;

  const submit = async (body: string) => {
    try {
      await createComment.mutateAsync(body);
      notify('Comment posted. Thanks for buzzing in!', 'success');
    } catch (err) {
      notify(friendlyErrorMessage('post your comment', err), 'error');
      throw err;
    }
  };

  return (
    <Box component="section" aria-labelledby={heading ? headingId : undefined} aria-label={heading ? undefined : 'Comments'}>
      <Stack spacing={2}>
        {heading && (
          <Typography id={headingId} variant="h5" component="h2" sx={{ fontWeight: 600 }}>
            {heading}
          </Typography>
        )}
        <CommentForm onSubmit={submit} isSubmitting={createComment.isPending} />
        <Divider />
        {isPending && <CommentListSkeleton />}
        {isError && <ErrorState compact error={error} onRetry={() => void refetch()} title="Comments are out buzzing" />}
        {data && <CommentList comments={data} />}
      </Stack>
    </Box>
  );
}
