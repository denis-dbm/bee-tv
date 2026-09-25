import type { Episode, Season, ShowDetails } from './api';

export function episodeCode(episode: Pick<Episode, 'season' | 'number'>): string {
  const season = `S${String(episode.season).padStart(2, '0')}`;
  return episode.number === null ? `${season} · Special` : `${season}E${String(episode.number).padStart(2, '0')}`;
}

export function seasonLabel(season: Pick<Season, 'number'>): string {
  return season.number === 0 ? 'Specials' : `Season ${season.number}`;
}

/** The first regular season is the most useful landing tab; specials only if nothing else. */
export function defaultSeasonIndex(seasons: Season[]): number {
  const index = seasons.findIndex((season) => season.number > 0);
  return index === -1 ? 0 : index;
}

export function showMeta(show: ShowDetails): string[] {
  const years = show.year
    ? show.ended && show.ended.slice(0, 4) !== String(show.year)
      ? `${show.year}–${show.ended.slice(0, 4)}`
      : String(show.year)
    : null;
  return [years, show.network, show.status, show.language].filter(
    (part): part is string => Boolean(part),
  );
}
