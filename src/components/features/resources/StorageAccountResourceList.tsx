'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Grid,
  Stack,
  Typography,
} from '@mui/material';
import { formatObservationClassification } from '@/lib/observations/presentation';
import { azureStorageAccountResourceKind } from '@/lib/resources/managedResourceKind';

type StorageAccountObservationSummary = {
  resourceName: string;
  classification: {
    code:
      | 'scan_error'
      | 'deleting'
      | 'provisioning'
      | 'missing_in_azure'
      | 'orphaned_in_azure'
      | 'identity_drift'
      | 'ownership_drift'
      | 'config_drift'
      | 'in_sync';
    severity: 'critical' | 'warning' | 'info' | 'success';
    reasonCodes: string[];
    diffCount: number;
  };
  desired: {
    resourceGroupName?: string;
    location?: string;
    replicationType?: string;
    accessTier?: string;
  };
  live: {
    resourceGroupName?: string;
    location?: string;
    replicationType?: string;
    accessTier?: string;
  };
};

function getObservationChipColor(
  code: StorageAccountObservationSummary['classification']['code']
) {
  switch (code) {
    case 'in_sync':
      return 'success';
    case 'provisioning':
      return 'info';
    case 'deleting':
    case 'config_drift':
    case 'ownership_drift':
    case 'identity_drift':
      return 'warning';
    default:
      return 'error';
  }
}

export default function StorageAccountResourceList() {
  const resourceKind = azureStorageAccountResourceKind;
  const observationsPathname = resourceKind.observationsPathname;
  const router = useRouter();
  const searchParams = useSearchParams();
  const deletingResourceName = searchParams.get('deleting');
  const [resources, setResources] = useState<
    StorageAccountObservationSummary[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    async function loadResources() {
      try {
        setError(null);
        const response = await fetch(observationsPathname);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to load storage resources');
        }

        if (!isActive) {
          return;
        }

        setResources(data.data || []);
      } catch (loadError: unknown) {
        if (!isActive) {
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Failed to load storage resources'
        );
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    }

    void loadResources();

    return () => {
      isActive = false;
    };
  }, [observationsPathname]);

  useEffect(() => {
    if (!deletingResourceName) {
      return;
    }

    if (
      !resources.some(
        (resource) => resource.resourceName === deletingResourceName
      )
    ) {
      router.replace('/resources');
      return;
    }

    const timer = window.setTimeout(async () => {
      try {
        setError(null);

        const response = await fetch(`${observationsPathname}?refresh=true`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to load storage resources');
        }

        setResources(data.data || []);
      } catch (loadError: unknown) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Failed to load storage resources'
        );
      }
    }, 3000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [deletingResourceName, observationsPathname, resources, router]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  if (resources.length === 0) {
    return (
      <Card elevation={0}>
        <CardContent sx={{ p: 4 }}>
          <Stack spacing={2} alignItems="flex-start">
            <Typography variant="h5" component="h2" sx={{ fontWeight: 600 }}>
              No managed resources are available yet
            </Typography>
            <Typography variant="body1" color="text.secondary">
              {resourceKind.emptyStateDescription}
            </Typography>
            <Button
              component={Link}
              href={resourceKind.catalogHref}
              variant="contained"
              disableElevation
            >
              {resourceKind.emptyStateActionLabel}
            </Button>
          </Stack>
        </CardContent>
      </Card>
    );
  }

  return (
    <Grid container spacing={2}>
      {resources.map((resource) => {
        const name = resource.resourceName || 'unknown-resource';
        const desired = resource.desired;
        const classificationLabel =
          deletingResourceName === name
            ? 'Deleting'
            : formatObservationClassification(resource.classification.code);

        return (
          <Grid key={name} size={{ xs: 12, md: 6, xl: 4 }}>
            <Card elevation={0} sx={{ height: '100%' }}>
              <CardContent sx={{ p: 3 }}>
                <Stack spacing={2.5} sx={{ height: '100%' }}>
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    spacing={2}
                  >
                    <Box>
                      <Typography
                        variant="h6"
                        component="h2"
                        sx={{ fontWeight: 600 }}
                      >
                        {name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {resourceKind.displayName}
                      </Typography>
                    </Box>
                    <Chip
                      label={classificationLabel}
                      color={
                        deletingResourceName === name
                          ? 'warning'
                          : getObservationChipColor(
                              resource.classification.code
                            )
                      }
                      size="small"
                    />
                  </Stack>

                  <Stack spacing={1}>
                    <Typography variant="body2" color="text.secondary">
                      Resource group: {desired?.resourceGroupName || 'Unknown'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Location: {desired?.location || 'Unknown'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Replication: {desired?.replicationType || 'Unknown'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Access tier: {desired?.accessTier || 'Unknown'}
                    </Typography>
                    {resource.classification.diffCount > 0 ? (
                      <Typography variant="body2" color="warning.main">
                        {resource.classification.diffCount} difference
                        {resource.classification.diffCount === 1 ? '' : 's'}
                      </Typography>
                    ) : null}
                  </Stack>

                  <Box sx={{ mt: 'auto' }}>
                    <Button
                      component={Link}
                      href={`/resources/${name}`}
                      variant="contained"
                      disableElevation
                      fullWidth
                      aria-label={`View details for ${name}`}
                    >
                      View Details
                    </Button>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        );
      })}
    </Grid>
  );
}
