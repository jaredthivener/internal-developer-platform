import { Suspense } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import StorageAccountResourceList from '@/components/features/resources/StorageAccountResourceList';

export default function ResourcesPage() {
  return (
    <Box sx={{ maxWidth: 1440, margin: '0 auto', width: '100%' }}>
      <Box
        sx={{
          mb: 4.5,
          px: { xs: 0.5, md: 0 },
        }}
      >
        <Stack spacing={1.25}>
          <Typography
            variant="h3"
            component="h1"
            sx={{
              fontWeight: 600,
              color: 'text.primary',
              letterSpacing: '-0.03em',
            }}
          >
            Resources
          </Typography>
          <Typography
            variant="body1"
            color="text.secondary"
            sx={{ maxWidth: 840 }}
          >
            Review provisioned platform resources, inspect their status, and
            open deeper operational actions for each managed service.
          </Typography>
        </Stack>
      </Box>
      <Suspense fallback={null}>
        <StorageAccountResourceList />
      </Suspense>
    </Box>
  );
}
