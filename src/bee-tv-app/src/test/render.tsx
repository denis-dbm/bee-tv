import { QueryClient } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { createMemoryRouter, RouterProvider, type RouteObject } from 'react-router';
import { AppProviders } from '@/app/AppProviders';
import { FakeHttpClient } from './fakeHttpClient';

export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } },
  });
}

interface RenderOptions {
  http?: FakeHttpClient;
  route?: string;
  path?: string;
}

function renderRoutes(routes: RouteObject[], http: FakeHttpClient, route: string) {
  const queryClient = createTestQueryClient();
  const router = createMemoryRouter(routes, { initialEntries: [route] });
  const user = userEvent.setup();
  const result = render(
    <AppProviders httpClient={http} queryClient={queryClient}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return { ...result, http, queryClient, router, user };
}

/** Renders a component inside every app provider, mounted at `path` and visited at `route`. */
export function renderWithProviders(ui: ReactElement, { http = new FakeHttpClient(), route = '/', path = '/' }: RenderOptions = {}) {
  return renderRoutes(
    [
      { path, element: ui },
      { path: '*', element: <p>Navigated away</p> },
    ],
    http,
    route,
  );
}

export async function renderApp(route: string, http: FakeHttpClient = new FakeHttpClient()) {
  const { routes } = await import('@/app/routes');
  return renderRoutes(routes, http, route);
}
