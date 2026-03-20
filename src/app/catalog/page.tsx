import { Box, Stack, Typography } from '@mui/material';
import CloudResourceCatalog from '@/components/features/catalog/CloudResourceCatalog';

export default function CatalogPage() {
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
            Catalog
          </Typography>
          <Typography
            variant="body1"
            color="text.secondary"
            sx={{ maxWidth: 840 }}
          >
            Choose a platform resource, review its operating context, and open a
            dedicated workflow for provisioning through the Crossplane control
            plane.
          </Typography>
        </Stack>
      </Box>

      <CloudResourceCatalog />
    </Box>
  );
}
