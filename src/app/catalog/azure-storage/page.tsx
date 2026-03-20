import { Box, Button, Stack, Typography } from '@mui/material';
import AzureStorageAccountWorkflow from '@/components/features/catalog/AzureStorageAccountWorkflow';

export default function AzureStorageCatalogPage() {
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
            <Button href="/catalog" variant="text">
              Back to catalog
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
            Azure Storage Account
          </Typography>
          <Typography
            variant="body1"
            color="text.secondary"
            sx={{ maxWidth: 840 }}
          >
            Request a governed Azure Storage account through the platform
            catalog instead of dealing with infrastructure implementation
            details.
          </Typography>
        </Stack>
      </Box>

      <AzureStorageAccountWorkflow />
    </Box>
  );
}
