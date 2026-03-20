'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
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
      accountTier?: string;
      accountReplicationType?: string;
      accessTier?: string;
      publicNetworkAccessEnabled?: boolean;
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

export default function StorageAccountResourceDetails({
  resourceName,
}: {
  resourceName: string;
}) {
  const router = useRouter();
  const [resource, setResource] = useState<StorageAccountResource | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    async function loadResource() {
      try {
        const response = await fetch(
          `/api/crossplane/resources?group=storage.azure.upbound.io&version=v1beta1&plural=accounts&name=${encodeURIComponent(resourceName)}`
        );
        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.error || 'Failed to load storage account details'
          );
        }

        if (!isActive) {
          return;
        }

        setResource(data.data);
      } catch (loadError: unknown) {
        if (!isActive) {
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Failed to load storage account details'
        );
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    }

    void loadResource();

    return () => {
      isActive = false;
    };
  }, [resourceName]);

  async function handleDelete() {
    setConfirmOpen(false);
    setDeleting(true);
    setError(null);

    try {
      const response = await fetch('/api/crossplane/resources', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          group: 'storage.azure.upbound.io',
          version: 'v1beta1',
          plural: 'accounts',
          name: resourceName,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete resource');
      }

      router.push(`/resources?deleting=${encodeURIComponent(resourceName)}`);
    } catch (deleteError: unknown) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : 'Failed to delete resource'
      );
      setDeleting(false);
    }
  }

  function handleDeleteClick() {
    setConfirmOpen(true);
  }

  function handleDeleteCancel() {
    if (!deleting) {
      setConfirmOpen(false);
    }
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error && !resource) {
    return <Alert severity="error">{error}</Alert>;
  }

  if (!resource) {
    return <Alert severity="warning">Storage account not found.</Alert>;
  }

  const provider = resource.spec?.forProvider;
  const statusLabel = deleting ? 'Deleting' : getReadyLabel(resource);
  const statusColor = deleting
    ? 'warning'
    : statusLabel === 'Ready'
      ? 'success'
      : 'warning';

  return (
    <>
      <Card elevation={0}>
        <CardContent sx={{ p: { xs: 3, md: 4 } }}>
          <Stack spacing={3}>
            {error ? <Alert severity="error">{error}</Alert> : null}

            <Stack
              direction={{ xs: 'column', md: 'row' }}
              justifyContent="space-between"
              spacing={2}
            >
              <Box>
                <Typography
                  variant="h4"
                  component="h2"
                  sx={{ fontWeight: 600 }}
                >
                  {resource.metadata?.name || resourceName}
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  Managed Azure Storage account provisioned through Crossplane.
                </Typography>
              </Box>
              <Stack direction="row" spacing={1} alignItems="flex-start">
                <Chip label={statusLabel} color={statusColor} />
                <Button
                  color="error"
                  variant="outlined"
                  onClick={handleDeleteClick}
                  disabled={deleting}
                >
                  Delete Resource
                </Button>
              </Stack>
            </Stack>

            <Divider />

            <Stack spacing={1.25}>
              <Typography variant="body2" color="text.secondary">
                Resource group: {provider?.resourceGroupName || 'Unknown'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Location: {provider?.location || 'Unknown'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Account tier: {provider?.accountTier || 'Unknown'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Replication: {provider?.accountReplicationType || 'Unknown'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Access tier: {provider?.accessTier || 'Unknown'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Public network access:{' '}
                {provider?.publicNetworkAccessEnabled ? 'Enabled' : 'Disabled'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Azure resource ID:{' '}
                {resource.status?.atProvider?.id || 'Unknown'}
              </Typography>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <Dialog
        open={confirmOpen}
        onClose={handleDeleteCancel}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Confirm deletion</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            This starts deletion for the storage account and removes it from the
            platform inventory once reconciliation completes.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel} disabled={deleting}>
            Cancel
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={handleDelete}
            disabled={deleting}
          >
            Confirm Delete
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
