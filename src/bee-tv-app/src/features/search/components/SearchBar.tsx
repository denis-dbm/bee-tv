import ClearIcon from '@mui/icons-material/Clear';
import SearchIcon from '@mui/icons-material/Search';
import { IconButton, InputBase, Paper } from '@mui/material';
import type { FormEvent } from 'react';

export interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: (value: string) => void;
  size?: 'large' | 'compact';
  focusOnMount?: boolean;
  placeholder?: string;
}

/** Search-engine style pill. Controlled: the owner decides where the query lives (URL, state). */
export function SearchBar({
  value,
  onChange,
  onSubmit,
  size = 'large',
  focusOnMount = false,
  placeholder = 'Search TV series…',
}: SearchBarProps) {
  const large = size === 'large';

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit?.(value.trim());
  };

  return (
    <Paper
      component="form"
      role="search"
      onSubmit={submit}
      elevation={large ? 3 : 0}
      sx={{
        display: 'flex',
        alignItems: 'center',
        width: '100%',
        maxWidth: large ? 680 : 420,
        mx: large ? 'auto' : 0,
        px: large ? 2 : 1,
        py: large ? 0.75 : 0.25,
        borderRadius: 999,
        border: 1,
        borderColor: 'divider',
        transition: 'box-shadow 150ms',
        '&:focus-within': { boxShadow: 6, borderColor: 'primary.main' },
      }}
    >
      <SearchIcon color="action" aria-hidden="true" />
      <InputBase
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        // Search is the sole purpose of the home page (search-engine pattern), so focusing it is expected.
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus={focusOnMount}
        inputProps={{ 'aria-label': 'Search TV series', type: 'search', maxLength: 100 }}
        sx={{
          ml: 1.5,
          flex: 1,
          fontSize: large ? '1.15rem' : '0.95rem',
          // Our own clear button replaces the browser's native one.
          '& input::-webkit-search-cancel-button': { display: 'none' },
        }}
      />
      {value && (
        <IconButton aria-label="Clear search" onClick={() => onChange('')} size="small">
          <ClearIcon fontSize="small" />
        </IconButton>
      )}
    </Paper>
  );
}
