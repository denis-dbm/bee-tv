import { createContext, useContext } from 'react';
import type { HttpClient } from './httpClient';

export const HttpClientContext = createContext<HttpClient | null>(null);

/** Dependency injection seam: tests provide a fake client, the app a fetch-based one. */
export function useHttpClient(): HttpClient {
  const client = useContext(HttpClientContext);
  if (!client) throw new Error('useHttpClient must be used within an HttpClientContext provider');
  return client;
}
