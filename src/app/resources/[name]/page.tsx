import KeyboardArrowLeftRoundedIcon from '@mui/icons-material/KeyboardArrowLeftRounded';
import { Box, Button, Chip, Stack, Typography } from '@mui/material';
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
        <Stack spacing={1.75}>
          <Box>
            <Button
              href="/resources"
              variant="text"
              startIcon={<KeyboardArrowLeftRoundedIcon />}
            >
              Back to resources
            </Button>
          </Box>

          <Chip
            label="Resource operations"
            size="small"
            sx={{ alignSelf: 'flex-start', fontWeight: 600 }}
          />

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
            Inspect runtime health, compare desired and observed configuration,
            and take the next operational action from a single console view.
          </Typography>
        </Stack>
      </Box>

      <StorageAccountResourceDetails resourceName={decodeURIComponent(name)} />
    </Box>
  );
}
