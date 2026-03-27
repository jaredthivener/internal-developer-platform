import KeyboardArrowLeftRoundedIcon from '@mui/icons-material/KeyboardArrowLeftRounded';
import { Box, Chip } from '@mui/material';
import StorageAccountResourceDetails from '@/components/features/resources/StorageAccountResourceDetails';
import PageHeader, { pageSectionSx } from '@/components/layout/PageHeader';
import ButtonLink from '@/components/ui/ButtonLink';

export default async function ResourceDetailsPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = await params;

  return (
    <Box sx={pageSectionSx}>
      <PageHeader
        title="Resource Details"
        description="Inspect runtime health, compare desired and observed configuration, and take the next operational action from a single console view."
        action={
          <ButtonLink
            href="/resources"
            variant="text"
            startIcon={<KeyboardArrowLeftRoundedIcon />}
          >
            Back to resources
          </ButtonLink>
        }
        eyebrow={
          <Chip
            label="Resource operations"
            size="small"
            sx={{ alignSelf: 'flex-start', fontWeight: 600 }}
          />
        }
        stackSpacing={1.75}
      />

      <StorageAccountResourceDetails resourceName={decodeURIComponent(name)} />
    </Box>
  );
}
