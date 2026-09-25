import { Alert, Snackbar } from '@mui/material';
import { type ReactNode, useCallback, useState } from 'react';
import { NotificationContext, type NotificationSeverity } from './notificationContext';

interface Notification {
  id: number;
  message: string;
  severity: NotificationSeverity;
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<Notification | null>(null);

  const notify = useCallback((message: string, severity: NotificationSeverity = 'info') => {
    setCurrent({ id: Date.now(), message, severity });
  }, []);

  const close = () => setCurrent(null);

  return (
    <NotificationContext.Provider value={notify}>
      {children}
      <Snackbar
        key={current?.id}
        open={current !== null}
        autoHideDuration={5000}
        onClose={(_, reason) => reason !== 'clickaway' && close()}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {current ? (
          <Alert onClose={close} severity={current.severity} variant="filled" sx={{ width: '100%' }}>
            {current.message}
          </Alert>
        ) : undefined}
      </Snackbar>
    </NotificationContext.Provider>
  );
}
