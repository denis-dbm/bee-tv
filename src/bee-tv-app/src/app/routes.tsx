import type { RouteObject } from 'react-router';
import { SearchPage } from '@/pages/SearchPage';
import { AppLayout } from './AppLayout';
import { PageLoader } from './PageLoader';

export const routes: RouteObject[] = [
  {
    element: <AppLayout />,
    hydrateFallbackElement: <PageLoader />,
    children: [
      { index: true, element: <SearchPage /> },
      {
        path: 'shows/:showId',
        lazy: async () => ({ Component: (await import('@/pages/ShowDetailsPage')).ShowDetailsPage }),
      },
      {
        path: '*',
        lazy: async () => ({ Component: (await import('@/pages/NotFoundPage')).NotFoundPage }),
      },
    ],
  },
];
