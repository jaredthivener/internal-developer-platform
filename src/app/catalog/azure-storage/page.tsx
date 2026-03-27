import { Box } from '@mui/material';
import AzureStorageAccountWorkflow from '@/components/features/catalog/AzureStorageAccountWorkflow';
import PageHeader, { pageSectionSx } from '@/components/layout/PageHeader';
import ButtonLink from '@/components/ui/ButtonLink';

export default function AzureStorageCatalogPage() {
  return (
    <Box sx={pageSectionSx}>
      <PageHeader
        title="Azure Storage Account"
        description="Request a governed Azure Storage account through the platform catalog instead of dealing with infrastructure implementation details."
        action={
          <ButtonLink href="/catalog" variant="text">
            Back to catalog
          </ButtonLink>
        }
        stackSpacing={1.5}
      />

      <AzureStorageAccountWorkflow />
    </Box>
  );
}
