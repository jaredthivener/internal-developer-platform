import { Box, Stack, Typography } from '@mui/material';
import CloudEstateOverview from '@/components/features/catalog/CloudEstateOverview';
import CloudResourceCatalog from '@/components/features/catalog/CloudResourceCatalog';

export default function Home() {
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
            Cloud Estate
          </Typography>
          <Typography
            variant="body1"
            color="text.secondary"
            sx={{ maxWidth: 840 }}
          >
            Explore the platform-owned Azure estate through a clean catalog
            view. Track service inventory, cost drift, security posture, and
            operating health without turning the dashboard into a resource
            creation screen.
          </Typography>
        </Stack>
      </Box>

      <Stack spacing={3}>
        <CloudEstateOverview />
        <CloudResourceCatalog />
      </Stack>
    </Box>
  );
}
