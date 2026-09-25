import StarIcon from '@mui/icons-material/Star';
import { Box, Chip, Grid, Skeleton, Stack, Typography } from '@mui/material';
import type { ReactNode } from 'react';
import { PosterPlaceholder } from '@/shared/ui';
import type { ShowDetails } from '../api';
import { showMeta } from '../format';

export interface ShowHeaderProps {
  show: ShowDetails;
  /** Slot rendered right below the poster (e.g. the Bee Review button). */
  posterActions?: ReactNode;
}

export function ShowHeader({ show, posterActions }: ShowHeaderProps) {
  return (
    <Grid container spacing={{ xs: 3, md: 4 }} component="section" aria-labelledby="show-title">
      <Grid size={{ xs: 12, sm: 5, md: 4, lg: 3 }}>
        <Stack spacing={2} sx={{ maxWidth: 340, mx: { xs: 'auto', sm: 0 } }}>
          {show.posterUrl ? (
            <Box
              component="img"
              src={show.posterUrl}
              alt={`${show.title} poster`}
              sx={{ width: '100%', aspectRatio: '2 / 3', objectFit: 'cover', borderRadius: 2, boxShadow: 4 }}
            />
          ) : (
            <PosterPlaceholder sx={{ borderRadius: 2 }} />
          )}
          {posterActions}
        </Stack>
      </Grid>
      <Grid size={{ xs: 12, sm: 7, md: 8, lg: 9 }}>
        <Stack spacing={2}>
          <Typography id="show-title" variant="h3" component="h1" sx={{ fontWeight: 700 }}>
            {show.title}
          </Typography>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <Typography color="text.secondary">{showMeta(show).join(' · ')}</Typography>
            {show.rating !== null && (
              <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                <StarIcon fontSize="small" sx={{ color: 'primary.main' }} aria-hidden="true" />
                <Typography aria-label={`Rated ${show.rating} out of 10`}>{show.rating.toFixed(1)}</Typography>
              </Stack>
            )}
          </Stack>
          <Typography variant="body1" sx={{ fontSize: '1.05rem', lineHeight: 1.7, maxWidth: '75ch' }}>
            {show.summary || 'No summary available yet.'}
          </Typography>
          {show.genres.length > 0 && (
            <Stack
              direction="row"
              spacing={1}
              useFlexGap
              component="ul"
              aria-label="Genres"
              sx={{ flexWrap: 'wrap', listStyle: 'none', p: 0, m: 0 }}
            >
              {show.genres.map((genre) => (
                <li key={genre}>
                  <Chip label={genre} color="primary" variant="outlined" />
                </li>
              ))}
            </Stack>
          )}
        </Stack>
      </Grid>
    </Grid>
  );
}

export function ShowHeaderSkeleton() {
  return (
    <Grid container spacing={4} aria-busy="true" aria-label="Loading series">
      <Grid size={{ xs: 12, sm: 5, md: 4, lg: 3 }}>
        <Skeleton variant="rounded" sx={{ aspectRatio: '2 / 3', height: 'auto', maxWidth: 340 }} />
      </Grid>
      <Grid size={{ xs: 12, sm: 7, md: 8, lg: 9 }}>
        <Skeleton variant="text" sx={{ fontSize: '3rem', width: '60%' }} />
        <Skeleton width="40%" />
        <Skeleton variant="rounded" height={120} sx={{ mt: 2 }} />
      </Grid>
    </Grid>
  );
}
