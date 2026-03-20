import { Box, Button, Stack, Typography } from '@mui/material';
import StorageAccountResourceDetails from '@/components/features/resources/StorageAccountResourceDetails';

export default async function ResourceDetailsPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = await params;

  return (
    <Box sx={{ maxWidth: 1440, margin: '0 auto', width: '100%' }}>
      <Box
        sx={{
          mb: 4.5,
          px: { xs: 0.5, md: 0 },
        }}
      >
        <Stack spacing={1.5}>
          <Box>
            <Button href="/resources" variant="text">
              Back to resources
            </Button>
          </Box>

          <Typography
            variant="h3"
            component="h1"
            sx={{
              fontWeight: 600,
              color: 'text.primary',
              letterSpacing: '-0.03em',
            }}
          >
            Resource Details
          </Typography>
          <Typography
            variant="body1"
            color="text.secondary"
            sx={{ maxWidth: 840 }}
          >
            Inspect the current configuration, provider state, and lifecycle
            actions for the selected storage account.
          </Typography>
        </Stack>
      </Box>

      <StorageAccountResourceDetails resourceName={decodeURIComponent(name)} />
    </Box>
  );
}
