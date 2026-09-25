import { CssBaseline, ThemeProvider } from '@mui/material';
import { type QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode, useState } from 'react';
import { createQueryClient, FetchHttpClient, type HttpClient, HttpClientContext } from '@/shared/api';
import { NotificationProvider } from '@/shared/ui';
import { theme } from './theme';

export interface AppProvidersProps {
  children: ReactNode;
  httpClient?: HttpClient;
  queryClient?: QueryClient;
}

/** Cross-cutting providers. Every dependency is injectable for tests. */
export function AppProviders({ children, httpClient, queryClient }: AppProvidersProps) {
  const [http] = useState<HttpClient>(() => httpClient ?? new FetchHttpClient());
  const [client] = useState<QueryClient>(() => queryClient ?? createQueryClient());

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <HttpClientContext.Provider value={http}>
        <QueryClientProvider client={client}>
          <NotificationProvider>{children}</NotificationProvider>
        </QueryClientProvider>
      </HttpClientContext.Provider>
    </ThemeProvider>
  );
}
