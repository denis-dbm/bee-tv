import { Button, Container } from '@mui/material';
import { Link as RouterLink } from 'react-router';
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle';
import { EmptyState } from '@/shared/ui';

export function NotFoundPage() {
  useDocumentTitle('Page not found');
  return (
    <Container maxWidth="sm" sx={{ py: 6, textAlign: 'center' }}>
      <EmptyState
        mood="lost"
        size={150}
        title="This page flew out of the hive"
        description="The address may be mistyped, or the page no longer exists."
      />
      <Button component={RouterLink} to="/" variant="contained">
        Go to search
      </Button>
    </Container>
  );
}
