import { Box, Card, CardContent, Grid, LinearProgress, Skeleton, Typography } from '@mui/material';
import { EmptyState, ErrorState } from '@/shared/ui';
import { useShowSearch } from '../useShowSearch';
import { ShowTile } from './ShowTile';

const GRID_SIZE = { xs: 6, sm: 4, md: 3, lg: 2.4 } as const;

function ResultsSkeleton() {
  return (
    <Grid container spacing={2} aria-hidden="true">
      {Array.from({ length: 10 }, (_, index) => (
        <Grid key={index} size={GRID_SIZE}>
          <Card>
            <Skeleton variant="rectangular" sx={{ aspectRatio: '2 / 3', height: 'auto' }} />
            <CardContent>
              <Skeleton width="80%" />
              <Skeleton width="40%" />
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
}

export function SearchResults({ query }: { query: string }) {
  const { data, error, isPending, isFetching, isError, refetch } = useShowSearch(query);
  const trimmed = query.trim();

  if (!trimmed) {
    return (
      <EmptyState
        title="What are we watching today?"
        description="Type the name of a series to explore its seasons, track episodes and get a Bee Review."
      />
    );
  }

  if (isError && !data) return <ErrorState error={error} onRetry={() => void refetch()} />;
  if (isPending) return <ResultsSkeleton />;

  return (
    <Box component="section" aria-labelledby="search-results-heading">
      <Box sx={{ height: 4, mb: 1 }}>{isFetching && <LinearProgress aria-label="Updating results" />}</Box>
      <Typography id="search-results-heading" variant="h6" component="h2" sx={{ mb: 2 }} aria-live="polite">
        {data.length === 0
          ? `No series found for “${trimmed}”`
          : `${data.length} series found for “${trimmed}”`}
      </Typography>
      {data.length === 0 ? (
        <EmptyState
          mood="lost"
          title="Our bees searched every flower"
          description="Try a different spelling or a shorter title."
        />
      ) : (
        <Grid container spacing={2} component="ul" sx={{ listStyle: 'none', p: 0, m: 0 }}>
          {data.map((show) => (
            <Grid key={show.id} size={GRID_SIZE} component="li">
              <ShowTile show={show} />
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
}
