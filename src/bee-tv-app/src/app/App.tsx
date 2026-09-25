import { useState } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { AppProviders } from './AppProviders';
import { routes } from './routes';

export function App() {
  const [router] = useState(() => createBrowserRouter(routes));
  return (
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  );
}
