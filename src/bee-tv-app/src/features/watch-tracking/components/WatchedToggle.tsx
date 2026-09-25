import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import { IconButton, Tooltip } from '@mui/material';
import { useWatchedEpisodes } from '../useWatchedEpisodes';

export interface WatchedToggleProps {
  watched: boolean;
  onToggle: () => void;
  episodeTitle: string;
  disabled?: boolean;
}

export function WatchedToggle({ watched, onToggle, episodeTitle, disabled = false }: WatchedToggleProps) {
  const label = watched ? `Watched: ${episodeTitle}. Mark as not watched` : `Mark ${episodeTitle} as watched`;
  return (
    <Tooltip title={watched ? 'Watched' : 'Mark as watched'}>
      <span>
        <IconButton
          aria-label={label}
          aria-pressed={watched}
          onClick={onToggle}
          disabled={disabled}
          color={watched ? 'success' : 'default'}
        >
          {watched ? <CheckCircleIcon /> : <RadioButtonUncheckedIcon />}
        </IconButton>
      </span>
    </Tooltip>
  );
}

/** Connected toggle: reads and writes the watched state of one episode. */
export function EpisodeWatchToggle({
  showId,
  episodeId,
  episodeTitle,
}: {
  showId: string;
  episodeId: string;
  episodeTitle: string;
}) {
  const { isWatched, toggle, isLoading } = useWatchedEpisodes(showId);
  return (
    <WatchedToggle
      watched={isWatched(episodeId)}
      onToggle={() => toggle(episodeId)}
      episodeTitle={episodeTitle}
      disabled={isLoading}
    />
  );
}
