'use client';

import { useCallback, useEffect, useState } from 'react';
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
  Grid,
  Stack,
  Typography,
} from '@mui/material';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import CompareArrowsRoundedIcon from '@mui/icons-material/CompareArrowsRounded';
import LinkRoundedIcon from '@mui/icons-material/LinkRounded';
import PublicRoundedIcon from '@mui/icons-material/PublicRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import ShieldRoundedIcon from '@mui/icons-material/ShieldRounded';
import StorageRoundedIcon from '@mui/icons-material/StorageRounded';
import SyncRoundedIcon from '@mui/icons-material/SyncRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import { formatObservationClassification } from '@/lib/observations/presentation';
import { azureStorageAccountResourceKind } from '@/lib/resources/managedResourceKind';

const SYNC_REQUEST_ANNOTATION = 'idp.jared.io/last-sync-requested-at';

type StorageAccountObservationDetail = {
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
    accountTier?: string;
    replicationType?: string;
    accessTier?: string;
    publicNetworkAccessEnabled?: boolean;
  };
  live: {
    resourceGroupName?: string;
    location?: string;
    accountTier?: string;
    replicationType?: string;
    accessTier?: string;
    publicNetworkAccessEnabled?: boolean;
  };
  crossplane: {
    name: string;
    ready: boolean;
    synced?: boolean;
  };
  azureResourceId?: string;
  observedAt?: string;
  diffs: Array<{
    field: string;
    desired: string | boolean | null;
    live: string | boolean | null;
    category:
      | 'identity'
      | 'ownership'
      | 'network'
      | 'security'
      | 'data'
      | 'sku';
  }>;
};

function getObservationChipColor(
  code: StorageAccountObservationDetail['classification']['code']
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

function formatReasonCode(reasonCode: string): string {
  switch (reasonCode) {
    case 'azureObservationUnavailable':
      return 'Azure verification unavailable';
    case 'azureResourceMissing':
      return 'Azure resource missing';
    case 'ready':
      return 'Waiting for ready condition';
    case 'externalName':
      return 'Provider identity pending';
    default:
      return reasonCode
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, (value) => value.toUpperCase());
  }
}

function formatFieldLabel(field: string): string {
  switch (field) {
    case 'resourceGroupName':
      return 'Resource group';
    case 'accountTier':
      return 'Account tier';
    case 'replicationType':
      return 'Replication';
    case 'accessTier':
      return 'Access tier';
    case 'publicNetworkAccessEnabled':
      return 'Public network access';
    default:
      return field
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, (value) => value.toUpperCase());
  }
}

function formatBoolean(value: boolean | undefined): string {
  return value ? 'Enabled' : 'Disabled';
}

function formatObservedAt(value?: string): string {
  if (!value) {
    return 'Observation pending';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

export default function StorageAccountResourceDetails({
  resourceName,
}: {
  resourceName: string;
}) {
  const resourceKind = azureStorageAccountResourceKind;
  const observationsPathname = resourceKind.observationsPathname;
  const router = useRouter();
  const [resource, setResource] =
    useState<StorageAccountObservationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const loadResource = useCallback(
    async (refresh = false) => {
      const response = await fetch(
        `${observationsPathname}/${encodeURIComponent(resourceName)}${refresh ? '?refresh=true' : ''}`
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load storage account details');
      }

      return data.data as StorageAccountObservationDetail;
    },
    [observationsPathname, resourceName]
  );

  useEffect(() => {
    let isActive = true;

    async function loadInitialResource() {
      try {
        const data = await loadResource();

        if (!isActive) {
          return;
        }

        setResource(data);
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

    void loadInitialResource();

    return () => {
      isActive = false;
    };
  }, [loadResource]);

  async function handleDelete() {
    setConfirmOpen(false);
    setDeleting(true);
    setError(null);
    setSyncMessage(null);

    try {
      const response = await fetch('/api/crossplane/resources', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          group: resourceKind.crossplane.group,
          version: resourceKind.crossplane.version,
          plural: resourceKind.crossplane.plural,
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

  async function handleRefresh() {
    setRefreshing(true);
    setError(null);
    setSyncMessage(null);

    try {
      const refreshedResource = await loadResource(true);
      setResource(refreshedResource);
      setSyncMessage('Status refreshed from the latest observation snapshot.');
    } catch (refreshError: unknown) {
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : 'Failed to refresh resource status'
      );
    } finally {
      setRefreshing(false);
    }
  }

  async function handleSync() {
    if (!resource) {
      return;
    }

    setSyncing(true);
    setError(null);
    setSyncMessage(null);

    try {
      const response = await fetch('/api/crossplane/resources', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          group: resourceKind.crossplane.group,
          version: resourceKind.crossplane.version,
          plural: resourceKind.crossplane.plural,
          name: resourceName,
          patch: {
            metadata: {
              annotations: {
                [SYNC_REQUEST_ANNOTATION]: new Date().toISOString(),
              },
            },
            spec: {
              forProvider: {
                resourceGroupName: resource.desired.resourceGroupName,
                location: resource.desired.location,
                accountTier: resource.desired.accountTier,
                accountReplicationType: resource.desired.replicationType,
                accessTier: resource.desired.accessTier,
                publicNetworkAccessEnabled:
                  resource.desired.publicNetworkAccessEnabled,
              },
            },
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to request sync');
      }

      const refreshedResource = await loadResource(true);
      setResource(refreshedResource);

      setSyncMessage(
        'Sync requested. Crossplane will reconcile the desired state.'
      );
    } catch (syncError: unknown) {
      setError(
        syncError instanceof Error
          ? syncError.message
          : 'Failed to request sync'
      );
    } finally {
      setSyncing(false);
    }
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
    return <Alert severity="warning">Managed resource not found.</Alert>;
  }

  const classification = resource.classification ?? {
    code: 'scan_error' as const,
    severity: 'critical' as const,
    reasonCodes: [],
    diffCount: 0,
  };
  const crossplane = resource.crossplane ?? {
    name: resourceName,
    ready: false,
    synced: false,
  };
  const diffs = resource.diffs ?? [];
  const desired = resource.desired;
  const live = resource.live;
  const statusLabel = deleting
    ? 'Deleting'
    : formatObservationClassification(classification.code);
  const statusColor = deleting
    ? 'warning'
    : getObservationChipColor(classification.code);
  const reasonLabels = classification.reasonCodes.map(formatReasonCode);
  const hasAzureObservationGap = classification.reasonCodes.includes(
    'azureObservationUnavailable'
  );
  const providerSummary = crossplane.ready
    ? crossplane.synced
      ? 'Healthy and reconciled'
      : 'Healthy, waiting for sync'
    : 'Reconciliation in progress';

  return (
    <>
      <Card elevation={0}>
        <CardContent sx={{ p: { xs: 3, md: 4 } }}>
          <Stack spacing={3.5}>
            {error ? <Alert severity="error">{error}</Alert> : null}
            {syncMessage ? (
              <Alert severity="success">{syncMessage}</Alert>
            ) : null}
            {hasAzureObservationGap ? (
              <Alert severity="info">
                Azure live verification is currently unavailable, so this view
                is using Crossplane health and the last known provider state.
              </Alert>
            ) : null}

            <Box
              sx={{
                borderRadius: 4,
                border: '1px solid',
                borderColor: 'divider',
                p: { xs: 2.5, md: 3.5 },
                background:
                  'linear-gradient(180deg, rgba(138, 180, 248, 0.10) 0%, rgba(138, 180, 248, 0.02) 44%, transparent 100%)',
              }}
            >
              <Stack spacing={3}>
                <Stack
                  direction={{ xs: 'column', lg: 'row' }}
                  justifyContent="space-between"
                  spacing={2.5}
                >
                  <Stack spacing={1.25}>
                    <Stack direction="row" spacing={1.25} alignItems="center">
                      <Box
                        sx={{
                          width: 44,
                          height: 44,
                          borderRadius: 2.5,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          bgcolor: 'primary.main',
                          color: 'primary.contrastText',
                        }}
                      >
                        <StorageRoundedIcon fontSize="small" />
                      </Box>
                      <Box>
                        <Typography
                          variant="overline"
                          sx={{
                            color: 'text.secondary',
                            letterSpacing: '0.08em',
                          }}
                        >
                          Storage account resource
                        </Typography>
                        <Typography
                          variant="h4"
                          component="h2"
                          sx={{ fontWeight: 600, lineHeight: 1.1 }}
                        >
                          {resource.resourceName || resourceName}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {resourceKind.displayName}
                        </Typography>
                      </Box>
                    </Stack>
                    <Typography
                      variant="body1"
                      color="text.secondary"
                      sx={{ maxWidth: 760 }}
                    >
                      Managed Azure Storage account provisioned through
                      Crossplane. Review provider health, desired configuration,
                      and any live-state drift signals before taking action.
                    </Typography>
                    <Stack
                      direction="row"
                      spacing={1}
                      flexWrap="wrap"
                      useFlexGap
                    >
                      <Chip label={statusLabel} color={statusColor} />
                      {reasonLabels.map((label) => (
                        <Chip
                          key={label}
                          label={label}
                          variant="outlined"
                          size="small"
                        />
                      ))}
                    </Stack>
                  </Stack>

                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={1}
                    alignItems={{ xs: 'stretch', sm: 'flex-start' }}
                  >
                    <Button
                      variant="outlined"
                      startIcon={
                        refreshing ? (
                          <CircularProgress size={16} color="inherit" />
                        ) : (
                          <RefreshRoundedIcon />
                        )
                      }
                      onClick={handleRefresh}
                      disabled={refreshing || deleting || syncing}
                      aria-label="Refresh status"
                    >
                      Refresh status
                    </Button>
                    {classification.diffCount > 0 ? (
                      <Button
                        variant="contained"
                        startIcon={<SyncRoundedIcon />}
                        onClick={handleSync}
                        disabled={syncing || deleting || refreshing}
                      >
                        Sync Resource
                      </Button>
                    ) : null}
                    <Button
                      color="error"
                      variant="outlined"
                      onClick={handleDeleteClick}
                      disabled={deleting || syncing || refreshing}
                    >
                      Delete Resource
                    </Button>
                  </Stack>
                </Stack>

                <Grid container spacing={1.5}>
                  <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
                    <Box
                      sx={{
                        p: 2,
                        borderRadius: 3,
                        border: '1px solid',
                        borderColor: 'divider',
                        backgroundColor: 'background.paper',
                      }}
                    >
                      <Stack spacing={1}>
                        <CheckCircleOutlineRoundedIcon
                          color="success"
                          fontSize="small"
                        />
                        <Typography variant="body2" color="text.secondary">
                          Provider state
                        </Typography>
                        <Typography variant="h6" sx={{ fontWeight: 600 }}>
                          {providerSummary}
                        </Typography>
                      </Stack>
                    </Box>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
                    <Box
                      sx={{
                        p: 2,
                        borderRadius: 3,
                        border: '1px solid',
                        borderColor: 'divider',
                        backgroundColor: 'background.paper',
                      }}
                    >
                      <Stack spacing={1}>
                        <CompareArrowsRoundedIcon
                          color="primary"
                          fontSize="small"
                        />
                        <Typography variant="body2" color="text.secondary">
                          Drift signals
                        </Typography>
                        <Typography variant="h6" sx={{ fontWeight: 600 }}>
                          {classification.diffCount}
                        </Typography>
                      </Stack>
                    </Box>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
                    <Box
                      sx={{
                        p: 2,
                        borderRadius: 3,
                        border: '1px solid',
                        borderColor: 'divider',
                        backgroundColor: 'background.paper',
                      }}
                    >
                      <Stack spacing={1}>
                        <PublicRoundedIcon color="primary" fontSize="small" />
                        <Typography variant="body2" color="text.secondary">
                          Last observed
                        </Typography>
                        <Typography
                          variant="h6"
                          sx={{ fontWeight: 600, fontSize: '1rem' }}
                        >
                          {formatObservedAt(resource.observedAt)}
                        </Typography>
                      </Stack>
                    </Box>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
                    <Box
                      sx={{
                        p: 2,
                        borderRadius: 3,
                        border: '1px solid',
                        borderColor: 'divider',
                        backgroundColor: 'background.paper',
                      }}
                    >
                      <Stack spacing={1}>
                        <ShieldRoundedIcon color="primary" fontSize="small" />
                        <Typography variant="body2" color="text.secondary">
                          Public access
                        </Typography>
                        <Typography variant="h6" sx={{ fontWeight: 600 }}>
                          {formatBoolean(desired?.publicNetworkAccessEnabled)}
                        </Typography>
                      </Stack>
                    </Box>
                  </Grid>
                </Grid>
              </Stack>
            </Box>

            <Grid container spacing={2}>
              <Grid size={{ xs: 12, lg: 7 }}>
                <Card elevation={0} sx={{ height: '100%' }}>
                  <CardContent sx={{ p: 3 }}>
                    <Stack spacing={2.5}>
                      <Stack spacing={0.5}>
                        <Typography variant="h6" sx={{ fontWeight: 600 }}>
                          Configuration snapshot
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Core settings pulled from the desired spec and the
                          latest observed provider state.
                        </Typography>
                      </Stack>

                      <Grid container spacing={2}>
                        {[
                          [
                            'Resource group',
                            desired?.resourceGroupName || 'Unknown',
                          ],
                          ['Location', desired?.location || 'Unknown'],
                          ['Account tier', desired?.accountTier || 'Unknown'],
                          [
                            'Desired replication',
                            desired?.replicationType || 'Unknown',
                          ],
                          [
                            'Live replication',
                            live?.replicationType || 'Unknown',
                          ],
                          ['Access tier', desired?.accessTier || 'Unknown'],
                        ].map(([label, value]) => (
                          <Grid key={label} size={{ xs: 12, sm: 6 }}>
                            <Box
                              sx={{
                                p: 2,
                                borderRadius: 3,
                                border: '1px solid',
                                borderColor: 'divider',
                                minHeight: 96,
                              }}
                            >
                              <Stack spacing={0.75}>
                                <Typography
                                  variant="body2"
                                  color="text.secondary"
                                >
                                  {label}
                                </Typography>
                                <Typography
                                  variant="h6"
                                  sx={{ fontWeight: 600 }}
                                >
                                  {value}
                                </Typography>
                              </Stack>
                            </Box>
                          </Grid>
                        ))}
                      </Grid>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>

              <Grid size={{ xs: 12, lg: 5 }}>
                <Stack spacing={2} sx={{ height: '100%' }}>
                  <Card elevation={0}>
                    <CardContent sx={{ p: 3 }}>
                      <Stack spacing={2}>
                        <Stack spacing={0.5}>
                          <Typography variant="h6" sx={{ fontWeight: 600 }}>
                            Control plane health
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Reconciliation signals reported by Crossplane.
                          </Typography>
                        </Stack>
                        <Stack spacing={1.25}>
                          <Stack
                            direction="row"
                            justifyContent="space-between"
                            spacing={2}
                          >
                            <Typography variant="body2" color="text.secondary">
                              Ready condition
                            </Typography>
                            <Chip
                              label={crossplane.ready ? 'Ready' : 'Pending'}
                              color={crossplane.ready ? 'success' : 'info'}
                              size="small"
                            />
                          </Stack>
                          <Stack
                            direction="row"
                            justifyContent="space-between"
                            spacing={2}
                          >
                            <Typography variant="body2" color="text.secondary">
                              Synced condition
                            </Typography>
                            <Chip
                              label={
                                crossplane.synced ? 'Synced' : 'Reconciling'
                              }
                              color={crossplane.synced ? 'success' : 'warning'}
                              size="small"
                            />
                          </Stack>
                        </Stack>
                      </Stack>
                    </CardContent>
                  </Card>

                  <Card elevation={0} sx={{ flexGrow: 1 }}>
                    <CardContent sx={{ p: 3 }}>
                      <Stack spacing={2}>
                        <Stack
                          direction="row"
                          spacing={1.25}
                          alignItems="center"
                        >
                          <LinkRoundedIcon color="primary" fontSize="small" />
                          <Typography variant="h6" sx={{ fontWeight: 600 }}>
                            Resource identity
                          </Typography>
                        </Stack>
                        <Box
                          sx={{
                            p: 2,
                            borderRadius: 3,
                            border: '1px solid',
                            borderColor: 'divider',
                            bgcolor: 'background.default',
                            overflowX: 'auto',
                          }}
                        >
                          <Typography
                            variant="body2"
                            sx={{
                              fontFamily:
                                'ui-monospace, SFMono-Regular, SF Mono, Menlo, monospace',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {resource.azureResourceId || 'Unknown'}
                          </Typography>
                        </Box>
                      </Stack>
                    </CardContent>
                  </Card>
                </Stack>
              </Grid>
            </Grid>

            <Card elevation={0}>
              <CardContent sx={{ p: 3 }}>
                <Stack spacing={2.5}>
                  <Stack spacing={0.5}>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      Drift analysis
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Compare the desired spec with the latest observed state.
                    </Typography>
                  </Stack>

                  {diffs.length > 0 ? (
                    <Stack spacing={1.25}>
                      {diffs.map((diff) => (
                        <Box
                          key={`${diff.field}-${String(diff.live)}`}
                          sx={{
                            p: 2,
                            borderRadius: 3,
                            border: '1px solid',
                            borderColor: 'warning.main',
                            bgcolor: 'warning.main',
                            color: 'warning.contrastText',
                            opacity: 0.92,
                          }}
                        >
                          <Stack
                            direction={{ xs: 'column', md: 'row' }}
                            spacing={2}
                            justifyContent="space-between"
                          >
                            <Stack
                              direction="row"
                              spacing={1.25}
                              alignItems="center"
                            >
                              <WarningAmberRoundedIcon fontSize="small" />
                              <Typography
                                variant="subtitle2"
                                sx={{ fontWeight: 600 }}
                              >
                                {formatFieldLabel(diff.field)}
                              </Typography>
                            </Stack>
                            <Stack
                              direction={{ xs: 'column', sm: 'row' }}
                              spacing={2}
                            >
                              <Typography variant="body2">
                                Desired: {String(diff.desired)}
                              </Typography>
                              <Typography variant="body2">
                                Live: {String(diff.live)}
                              </Typography>
                            </Stack>
                          </Stack>
                        </Box>
                      ))}
                    </Stack>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      No configuration differences are currently detected for
                      this resource.
                    </Typography>
                  )}
                </Stack>
              </CardContent>
            </Card>
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
