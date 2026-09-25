import { Card, CardActionArea, CardContent, CardMedia, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router';
import { PosterPlaceholder } from '@/shared/ui';
import type { ShowSearchResult } from '../api';

export function ShowTile({ show }: { show: ShowSearchResult }) {
  return (
    <Card sx={{ height: '100%', '&:hover': { boxShadow: 6 } }}>
      <CardActionArea
        component={RouterLink}
        to={`/shows/${show.id}`}
        sx={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}
      >
        {show.posterUrl ? (
          <CardMedia
            component="img"
            image={show.posterUrl}
            alt={`${show.title} poster`}
            loading="lazy"
            sx={{ aspectRatio: '2 / 3', objectFit: 'cover' }}
          />
        ) : (
          <PosterPlaceholder />
        )}
        <CardContent sx={{ flexGrow: 1 }}>
          <Typography variant="subtitle1" component="h3" sx={{ fontWeight: 600, lineHeight: 1.3 }}>
            {show.title}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {show.year ?? 'Year unknown'}
          </Typography>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}
