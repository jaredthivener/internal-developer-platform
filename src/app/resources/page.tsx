import { Suspense } from 'react';
import { Box } from '@mui/material';
import StorageAccountResourceList from '@/components/features/resources/StorageAccountResourceList';
import PageHeader, { pageSectionSx } from '@/components/layout/PageHeader';

export default function ResourcesPage() {
  return (
    <Box sx={pageSectionSx}>
      <PageHeader
        title="Resources"
        description="Review provisioned platform resources, inspect their status, and open deeper operational actions for each managed service."
      />
      <Suspense fallback={null}>
        <StorageAccountResourceList />
      </Suspense>
    </Box>
  );
}
