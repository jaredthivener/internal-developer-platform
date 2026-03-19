import { Box, Typography, Grid } from '@mui/material';
import CompositionList from '@/components/features/crossplane/CompositionList';
import ResourceProvisioner from '@/components/features/crossplane/ResourceProvisioner';

export default function Home() {
  return (
    <Box sx={{ maxWidth: 1200, margin: '0 auto', width: '100%' }}>
      <Box
        sx={{
          mb: 4,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
        }}
      >
        <Box>
          <Typography
            variant="h4"
            component="h1"
            sx={{ fontWeight: 600, color: 'text.primary', mb: 1 }}
          >
            Dashboard
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Manage your application environments and self-service deployments
          </Typography>
        </Box>
      </Box>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 8 }}>
          <CompositionList />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <ResourceProvisioner />
        </Grid>
      </Grid>
    </Box>
  );
}
