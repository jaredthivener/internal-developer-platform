import { Box } from '@mui/material';
import CloudResourceCatalog from '@/components/features/catalog/CloudResourceCatalog';
import PageHeader, { pageSectionSx } from '@/components/layout/PageHeader';

export default function CatalogPage() {
  return (
    <Box sx={pageSectionSx}>
      <PageHeader
        title="Catalog"
        description="Choose a platform resource, review its operating context, and open a dedicated workflow for provisioning through the Crossplane control plane."
      />

      <CloudResourceCatalog />
    </Box>
  );
}
