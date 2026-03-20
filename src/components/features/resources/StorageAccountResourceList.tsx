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

type StorageAccountResource = {
  metadata?: {
    name?: string;
    creationTimestamp?: string;
  };
  spec?: {
    forProvider?: {
      resourceGroupName?: string;
      location?: string;
      accountReplicationType?: string;
      accessTier?: string;
    };
  };
  status?: {
    atProvider?: {
      id?: string;
    };
    conditions?: Array<{
      type?: string;
      status?: string;
    }>;
  };
};

function getReadyLabel(resource: StorageAccountResource) {
  const isReady = resource.status?.conditions?.some(
    (condition) => condition.type === 'Ready' && condition.status === 'True'
  );

  return isReady ? 'Ready' : 'Pending';
}

export default function StorageAccountResourceList() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const deletingResourceName = searchParams.get('deleting');
  const [resources, setResources] = useState<StorageAccountResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    async function loadResources() {
      try {
        setError(null);
        const response = await fetch(
          '/api/crossplane/resources?group=storage.azure.upbound.io&version=v1beta1&plural=accounts'
        );
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
  }, []);

  useEffect(() => {
    if (!deletingResourceName) {
      return;
    }

    if (
      !resources.some(
        (resource) => resource.metadata?.name === deletingResourceName
      )
    ) {
      router.replace('/resources');
      return;
    }

    const timer = window.setTimeout(async () => {
      try {
        setError(null);

        const response = await fetch(
          '/api/crossplane/resources?group=storage.azure.upbound.io&version=v1beta1&plural=accounts'
        );
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
  }, [deletingResourceName, resources, router]);

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
              No storage accounts have been provisioned yet
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Create a storage account from the catalog and it will appear here
              for ongoing lifecycle operations.
            </Typography>
            <Button
              component={Link}
              href="/catalog/azure-storage"
              variant="contained"
              disableElevation
            >
              Open the catalog to create one
            </Button>
          </Stack>
        </CardContent>
      </Card>
    );
  }

  return (
    <Grid container spacing={2}>
      {resources.map((resource) => {
        const name = resource.metadata?.name || 'unknown-resource';
        const provider = resource.spec?.forProvider;

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
                        Storage Account
                      </Typography>
                    </Box>
                    <Chip
                      label={
                        deletingResourceName === name
                          ? 'Deleting'
                          : getReadyLabel(resource)
                      }
                      color={
                        deletingResourceName === name
                          ? 'warning'
                          : getReadyLabel(resource) === 'Ready'
                            ? 'success'
                            : 'warning'
                      }
                      size="small"
                    />
                  </Stack>

                  <Stack spacing={1}>
                    <Typography variant="body2" color="text.secondary">
                      Resource group: {provider?.resourceGroupName || 'Unknown'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Location: {provider?.location || 'Unknown'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Replication:{' '}
                      {provider?.accountReplicationType || 'Unknown'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Access tier: {provider?.accessTier || 'Unknown'}
                    </Typography>
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
