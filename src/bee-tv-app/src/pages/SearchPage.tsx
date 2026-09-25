import { Box, Container, Stack, Typography } from '@mui/material';
import { useEffect, useEffectEvent, useState } from 'react';
import { useSearchParams } from 'react-router';
import { SearchBar, SearchResults } from '@/features/search';
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue';
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle';
import { BeeMascot, visuallyHidden } from '@/shared/ui';

export const SEARCH_DEBOUNCE_MS = 350;

/**
 * The URL (`?q=`) is the source of truth for results: shareable, and back/forward friendly.
 * The input is a local draft that is debounced into the URL.
 */
export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const query = params.get('q') ?? '';
  const [draft, setDraft] = useState(query);
  const [syncedQuery, setSyncedQuery] = useState(query);
  const debounced = useDebouncedValue(draft, SEARCH_DEBOUNCE_MS);

  // Back/forward navigation changes the URL: reflect it in the input.
  if (query !== syncedQuery) {
    setSyncedQuery(query);
    if (query !== draft.trim()) setDraft(query);
  }

  const commit = (value: string) => {
    const next = value.trim();
    if (next !== query) setParams(next ? { q: next } : {}, { replace: true });
  };
  const commitDebounced = useEffectEvent(commit);

  useEffect(() => commitDebounced(debounced), [debounced]);

  useDocumentTitle(query ? `Search: ${query}` : null);
  const hasQuery = query.length > 0;

  return (
    <Container maxWidth="xl" sx={{ py: { xs: 3, md: 5 } }}>
      <Stack
        spacing={3}
        sx={{
          alignItems: 'center',
          textAlign: 'center',
          pt: hasQuery ? 0 : { xs: 4, md: 10 },
          pb: hasQuery ? 2 : 4,
          transition: 'padding 250ms ease',
        }}
      >
        {!hasQuery && (
          <>
            <BeeMascot size={120} />
            <Box>
              <Typography variant="h2" component="h1" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>
                Bee TV
              </Typography>
              <Typography color="text.secondary" sx={{ mt: 1 }}>
                Find a series. Track every episode. Get the buzz.
              </Typography>
            </Box>
          </>
        )}
        {hasQuery && (
          <Typography variant="h4" component="h1" sx={visuallyHidden}>
            Search TV series
          </Typography>
        )}
        <SearchBar value={draft} onChange={setDraft} onSubmit={commit} focusOnMount />
      </Stack>
      <SearchResults query={query} />
    </Container>
  );
}
