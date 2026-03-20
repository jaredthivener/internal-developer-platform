import { Box, Button, Stack, Typography } from '@mui/material';
import CloudEstateOverview from '@/components/features/catalog/CloudEstateOverview';

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

        <Box
          sx={{
            p: { xs: 3, md: 4 },
            borderRadius: 4,
            border: '1px solid',
            borderColor: 'divider',
            background:
              'linear-gradient(135deg, rgba(11, 95, 255, 0.08), rgba(3, 169, 244, 0.04))',
          }}
        >
          <Stack spacing={2}>
            <Typography
              variant="overline"
              sx={{ letterSpacing: '0.12em', color: 'text.secondary' }}
            >
              Catalog
            </Typography>
            <Typography variant="h5" component="h2" sx={{ fontWeight: 600 }}>
              Open the self-service resource catalog
            </Typography>
            <Typography
              variant="body1"
              color="text.secondary"
              sx={{ maxWidth: 760 }}
            >
              Start resource creation from the catalog instead of the dashboard.
              Developers can browse available Azure services, open a resource
              workflow, and submit Crossplane-backed requests from there.
            </Typography>
            <Box>
              <Button
                href="/catalog"
                variant="contained"
                disableElevation
                aria-label="Open Catalog"
              >
                Open Catalog
              </Button>
            </Box>
          </Stack>
        </Box>
      </Stack>
    </Box>
  );
}
