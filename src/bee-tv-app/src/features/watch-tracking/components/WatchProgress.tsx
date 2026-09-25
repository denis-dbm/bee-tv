import { Box, LinearProgress, Typography } from '@mui/material';
import { useWatchedEpisodes } from '../useWatchedEpisodes';

export function WatchProgress({ showId, episodeIds }: { showId: string; episodeIds: string[] }) {
  const { watchedIds, isLoading } = useWatchedEpisodes(showId);
  if (isLoading || episodeIds.length === 0) return null;

  const watched = episodeIds.filter((id) => watchedIds.has(id)).length;
  const percent = Math.round((watched / episodeIds.length) * 100);

  return (
    <Box sx={{ width: '100%' }}>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
        {watched === episodeIds.length
          ? `All ${episodeIds.length} episodes watched. Queen bee status! 🐝`
          : `${watched} of ${episodeIds.length} episodes watched`}
      </Typography>
      <LinearProgress
        variant="determinate"
        value={percent}
        aria-label="Watch progress"
        sx={{ height: 8, borderRadius: 4 }}
      />
    </Box>
  );
}
