import {
  Box,
  Card,
  CardContent,
  Chip,
  Grid,
  Stack,
  Typography,
} from '@mui/material';
import PageHeader, { pageSectionSx } from '@/components/layout/PageHeader';

const applications = [
  {
    name: 'IDP Console',
    owner: 'Platform Engineering',
    stage: 'Production',
    summary:
      'Primary internal portal for catalog workflows, Crossplane-backed provisioning, and operational visibility.',
  },
  {
    name: 'Control Plane API',
    owner: 'Platform Runtime',
    stage: 'Pre-production',
    summary:
      'Backend integration surface for cluster automation, policy checks, and provisioning orchestration.',
  },
  {
    name: 'Developer Bootstrap',
    owner: 'Dev Experience',
    stage: 'Pilot',
    summary:
      'Standardized onboarding flow for new teams adopting AKS, Crossplane, and platform guardrails.',
  },
];

export default function ApplicationsPage() {
  return (
    <Box sx={pageSectionSx}>
      <PageHeader
        title="Applications"
        description="Track onboarding status, runtime ownership, and delivery readiness for the internal applications that rely on the platform."
      />

      <Stack spacing={3}>
        <Typography variant="h5" component="h2" sx={{ fontWeight: 600 }}>
          Application Inventory
        </Typography>

        <Grid container spacing={2}>
          {applications.map((application) => (
            <Grid key={application.name} size={{ xs: 12, md: 4 }}>
              <Card elevation={0} sx={{ height: '100%' }}>
                <CardContent sx={{ p: 3 }}>
                  <Stack spacing={2}>
                    <Stack
                      direction="row"
                      justifyContent="space-between"
                      spacing={2}
                      alignItems="flex-start"
                    >
                      <Typography
                        variant="h6"
                        component="h3"
                        sx={{ fontWeight: 600 }}
                      >
                        {application.name}
                      </Typography>
                      <Chip
                        label={application.stage}
                        size="small"
                        variant="outlined"
                      />
                    </Stack>
                    <Typography variant="body2" color="text.secondary">
                      {application.summary}
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      Owner: {application.owner}
                    </Typography>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Stack>
    </Box>
  );
}
