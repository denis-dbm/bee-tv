import { Box, Card, CardActions, CardContent, CardMedia, Stack, Typography } from '@mui/material';
import type { ReactNode } from 'react';
import { formatDate } from '@/shared/format';
import type { Episode } from '../api';
import { episodeCode } from '../format';

export interface EpisodeSlots {
  /** Rendered alongside the episode title (e.g. the watched toggle). */
  renderTitleAdornment?: (episode: Episode) => ReactNode;
  /** Rendered in the tile's action bar (e.g. comments and Bee Review buttons). */
  renderActions?: (episode: Episode) => ReactNode;
}

export function EpisodeTile({ episode, renderTitleAdornment, renderActions }: { episode: Episode } & EpisodeSlots) {
  const meta = [episodeCode(episode), formatDate(episode.airdate), episode.runtime ? `${episode.runtime} min` : null]
    .filter(Boolean)
    .join(' · ');

  return (
    <Card component="article" aria-labelledby={`episode-${episode.id}-title`} sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {episode.imageUrl && (
        <CardMedia
          component="img"
          image={episode.imageUrl}
          alt=""
          loading="lazy"
          sx={{ aspectRatio: '16 / 9', objectFit: 'cover' }}
        />
      )}
      <CardContent sx={{ flexGrow: 1 }}>
        <Typography variant="overline" color="text.secondary">
          {meta}
        </Typography>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <Typography id={`episode-${episode.id}-title`} variant="subtitle1" component="h3" sx={{ fontWeight: 600, lineHeight: 1.3, pt: 0.5 }}>
            {episode.title}
          </Typography>
          {renderTitleAdornment && <Box sx={{ flexShrink: 0, mt: -0.5 }}>{renderTitleAdornment(episode)}</Box>}
        </Stack>
        {episode.summary && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mt: 1, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
            title={episode.summary}
          >
            {episode.summary}
          </Typography>
        )}
      </CardContent>
      {renderActions && <CardActions sx={{ px: 2, pb: 2, pt: 0, gap: 1 }}>{renderActions(episode)}</CardActions>}
    </Card>
  );
}
