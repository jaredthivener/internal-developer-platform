import { Box, Stack, Typography } from '@mui/material';
import CloudEstateOverview from '@/components/features/catalog/CloudEstateOverview';
import PageHeader, { pageSectionSx } from '@/components/layout/PageHeader';
import ButtonLink from '@/components/ui/ButtonLink';
import { getLivePortfolio } from '@/lib/catalog/livePortfolio';

export default async function Home() {
  const portfolio = await getLivePortfolio();

  return (
    <Box sx={pageSectionSx}>
      <PageHeader
        title="Cloud Estate"
        description="Explore the platform-owned Azure estate through a clean catalog view. Track live service inventory, cost, and compliance without turning the dashboard into a resource creation screen."
      />

      <Stack spacing={3}>
        <CloudEstateOverview portfolio={portfolio} />

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
              <ButtonLink
                href="/catalog"
                variant="contained"
                disableElevation
                aria-label="Open Catalog"
              >
                Open Catalog
              </ButtonLink>
            </Box>
          </Stack>
        </Box>
      </Stack>
    </Box>
  );
}
