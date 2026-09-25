import { AppBar, Box, Container, Link, Stack, Toolbar, Typography } from '@mui/material';
import { useState } from 'react';
import { Link as RouterLink, Outlet, useLocation, useNavigate } from 'react-router';
import { SearchBar } from '@/features/search';
import { BeeMascot } from '@/shared/ui';

function HeaderSearch() {
  const [value, setValue] = useState('');
  const navigate = useNavigate();
  return (
    <SearchBar
      size="compact"
      value={value}
      onChange={setValue}
      onSubmit={(query) => query && void navigate(`/?q=${encodeURIComponent(query)}`)}
    />
  );
}

export function AppLayout() {
  const { pathname } = useLocation();
  const isHome = pathname === '/';

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Link
        href="#main-content"
        sx={{
          position: 'absolute',
          left: 8,
          top: -48,
          zIndex: (theme) => theme.zIndex.tooltip,
          bgcolor: 'primary.main',
          color: 'primary.contrastText',
          px: 2,
          py: 1,
          borderRadius: 1,
          '&:focus': { top: 8 },
        }}
      >
        Skip to content
      </Link>
      <AppBar position="sticky" elevation={0} sx={{ bgcolor: '#1b1b1b', color: '#fff' }}>
        <Toolbar sx={{ gap: 2 }}>
          <Link
            component={RouterLink}
            to="/"
            color="inherit"
            underline="none"
            aria-label="Bee TV home"
            sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
          >
            <BeeMascot size={36} />
            <Typography variant="h6" component="span" sx={{ fontWeight: 800 }}>
              Bee <Box component="span" sx={{ color: 'primary.main' }}>TV</Box>
            </Typography>
          </Link>
          <Box sx={{ flexGrow: 1, display: 'flex', justifyContent: 'flex-end' }}>
            {!isHome && <HeaderSearch />}
          </Box>
        </Toolbar>
      </AppBar>
      <Box component="main" id="main-content" tabIndex={-1} sx={{ flexGrow: 1, outline: 'none' }}>
        <Outlet />
      </Box>
      <Box component="footer" sx={{ py: 3, borderTop: 1, borderColor: 'divider' }}>
        <Container maxWidth="xl">
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ justifyContent: 'space-between' }}>
            <Typography variant="body2" color="text.secondary">
              © Bee TV. Made with honey.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Series data by{' '}
              <Link href="https://www.tvmaze.com" target="_blank" rel="noopener noreferrer">
                TVMaze
              </Link>{' '}
              (CC BY-SA)
            </Typography>
          </Stack>
        </Container>
      </Box>
    </Box>
  );
}
