import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { Button } from '@mui/material';
import { Link as RouterLink, matchPath, useLocation } from 'react-router';
import { useCachedShowTitle } from '@/features/show-details';
import { type InAppLocation, toHref, usePreviousLocation } from '@/shared/navigation';
import { describeBackTarget, SHOW_ROUTE } from './backTarget';

function BackLinkTo({ target }: { target: InAppLocation }) {
  const showId = matchPath(SHOW_ROUTE, target.pathname)?.params.showId;
  const label = describeBackTarget(target, useCachedShowTitle(showId));
  return (
    <Button
      component={RouterLink}
      to={toHref(target)}
      startIcon={<ArrowBackIcon />}
      size="small"
      // Pull the text button's padding back so the icon aligns with the content edge.
      sx={{ alignSelf: 'flex-start', ml: -1 }}
    >
      {label}
    </Button>
  );
}

/**
 * A real link (not `history.back()`) to the in-app page the user came from.
 * Hidden when the previous entry is outside the app, or is this very page.
 */
export function BackLink() {
  const previous = usePreviousLocation();
  const { pathname, search } = useLocation();
  if (!previous || (previous.pathname === pathname && previous.search === search)) return null;
  return <BackLinkTo target={previous} />;
}
