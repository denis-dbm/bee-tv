import { Box, Grid, Skeleton, Tab, Tabs, Typography } from '@mui/material';
import { useState } from 'react';
import { EmptyState, ErrorState } from '@/shared/ui';
import { defaultSeasonIndex, seasonLabel } from '../format';
import { useSeasons } from '../hooks';
import { EpisodeTile, type EpisodeSlots } from './EpisodeTile';

const GRID_SIZE = { xs: 12, sm: 6, md: 4, lg: 3 } as const;

export function SeasonsSection({ showId, ...slots }: { showId: string } & EpisodeSlots) {
  const { data: seasons, error, isPending, isError, refetch } = useSeasons(showId);
  const [selected, setSelected] = useState<number | null>(null);

  let content;
  if (isPending) {
    content = (
      <Grid container spacing={2} aria-busy="true" aria-label="Loading episodes">
        {Array.from({ length: 4 }, (_, index) => (
          <Grid key={index} size={GRID_SIZE}>
            <Skeleton variant="rounded" height={220} />
          </Grid>
        ))}
      </Grid>
    );
  } else if (isError) {
    content = <ErrorState compact error={error} onRetry={() => void refetch()} title="Episodes are buzzing off-schedule" />;
  } else {
    const index = Math.min(selected ?? defaultSeasonIndex(seasons), seasons.length - 1);
    const season = seasons[index];
    content = !season ? (
      <EmptyState title="No episodes announced yet" description="Check back soon, our bees are on it." />
    ) : (
      <>
        <Tabs
          value={index}
          onChange={(_, value: number) => setSelected(value)}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          aria-label="Seasons"
          sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
        >
          {seasons.map((item, i) => (
            <Tab
              key={item.number}
              label={`${seasonLabel(item)} (${item.episodes.length})`}
              id={`season-tab-${i}`}
              aria-controls={`season-panel-${i}`}
            />
          ))}
        </Tabs>
        <Box role="tabpanel" id={`season-panel-${index}`} aria-labelledby={`season-tab-${index}`}>
          <Grid container spacing={2} component="ul" sx={{ listStyle: 'none', p: 0, m: 0 }}>
            {season.episodes.map((episode) => (
              <Grid key={episode.id} size={GRID_SIZE} component="li">
                <EpisodeTile episode={episode} {...slots} />
              </Grid>
            ))}
          </Grid>
        </Box>
      </>
    );
  }

  return (
    <Box component="section" aria-labelledby="episodes-heading">
      <Typography id="episodes-heading" variant="h5" component="h2" sx={{ mb: 1, fontWeight: 600 }}>
        Episodes
      </Typography>
      {content}
    </Box>
  );
}
