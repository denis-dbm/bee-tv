import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { Button, Container, Divider, Stack } from '@mui/material';
import { useMemo } from 'react';
import { Link as RouterLink, useParams } from 'react-router';
import { BeeReviewButton } from '@/features/bee-review';
import { CommentsSection, EpisodeCommentsButton } from '@/features/comments';
import { type Episode, SeasonsSection, ShowHeader, ShowHeaderSkeleton, useSeasons, useShow } from '@/features/show-details';
import { EpisodeWatchToggle, WatchProgress } from '@/features/watch-tracking';
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle';
import { ErrorState } from '@/shared/ui';

/** Composition root of the details experience: wires independent features through slots. */
export function ShowDetailsPage() {
  const { showId = '' } = useParams();
  const show = useShow(showId);
  const seasons = useSeasons(showId);
  const episodeIds = useMemo(
    () => (seasons.data ?? []).flatMap((season) => season.episodes.map((episode) => episode.id)),
    [seasons.data],
  );
  useDocumentTitle(show.data?.title);

  if (show.isError) {
    return (
      <Container maxWidth="md">
        <ErrorState
          error={show.error}
          onRetry={() => void show.refetch()}
          action={
            <Button component={RouterLink} to="/" startIcon={<ArrowBackIcon />}>
              Back to search
            </Button>
          }
        />
      </Container>
    );
  }

  const renderTitleAdornment = (episode: Episode) => (
    <EpisodeWatchToggle showId={showId} episodeId={episode.id} episodeTitle={episode.title} />
  );
  const renderActions = (episode: Episode) => (
    <>
      <EpisodeCommentsButton showId={showId} episodeId={episode.id} episodeTitle={episode.title} />
      <BeeReviewButton variant="compact" target={{ showId, episodeId: episode.id }} subjectTitle={episode.title} />
    </>
  );

  return (
    <Container maxWidth="xl" sx={{ py: { xs: 3, md: 5 } }}>
      <Stack spacing={5}>
        {show.isPending ? (
          <ShowHeaderSkeleton />
        ) : (
          <ShowHeader
            show={show.data}
            posterActions={
              <Stack spacing={2}>
                <BeeReviewButton target={{ showId }} subjectTitle={show.data.title} />
                <WatchProgress showId={showId} episodeIds={episodeIds} />
              </Stack>
            }
          />
        )}
        <SeasonsSection showId={showId} renderTitleAdornment={renderTitleAdornment} renderActions={renderActions} />
        <Divider />
        <CommentsSection target={{ showId }} heading="Comments" />
      </Stack>
    </Container>
  );
}
