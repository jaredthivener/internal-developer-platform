'use client';

import React, { useEffect, useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  FormControlLabel,
  FormControl,
  FormHelperText,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import AddCircleOutlineRoundedIcon from '@mui/icons-material/AddCircleOutlineRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';

type AccessTier = 'Hot' | 'Cool';
type AccountTier = 'Standard' | 'Premium';
type ReplicationType = 'LRS' | 'ZRS' | 'GRS' | 'RAGRS' | 'GZRS' | 'RAGZRS';
type PublicNetworkAccess = 'Enabled' | 'Disabled';
type AccountKind =
  | 'StorageV2'
  | 'BlobStorage'
  | 'BlockBlobStorage'
  | 'FileStorage'
  | 'Storage';
type MinimumTlsVersion = 'TLS1_0' | 'TLS1_1' | 'TLS1_2';
type AllowedCopyScope = '' | 'AAD' | 'PrivateLink';
type ValidationMessage = {
  severity: 'info' | 'warning';
  message: string;
};

const storageAccountApiVersion = 'storage.azure.upbound.io/v1beta1';
const storageAccountKind = 'Account';

type StorageAccountWorkflowFormState = {
  accountName: string;
  resourceGroup: string;
  location: string;
  accountKind: AccountKind;
  accountTier: AccountTier;
  replicationType: ReplicationType;
  accessTier: AccessTier;
  publicNetworkAccess: PublicNetworkAccess;
  minimumTlsVersion: MinimumTlsVersion;
  httpsTrafficOnlyEnabled: boolean;
  infrastructureEncryptionEnabled: boolean;
  sharedAccessKeyEnabled: boolean;
  allowNestedItemsToBePublic: boolean;
  crossTenantReplicationEnabled: boolean;
  defaultToOauthAuthentication: boolean;
  isHnsEnabled: boolean;
  largeFileShareEnabled: boolean;
  localUserEnabled: boolean;
  nfsv3Enabled: boolean;
  sftpEnabled: boolean;
  allowedCopyScope: AllowedCopyScope;
};

type CrossplaneCondition = {
  type?: string;
  status?: string;
};

type CrossplaneResourceGroup = {
  metadata?: {
    name?: string;
  };
  status?: {
    conditions?: CrossplaneCondition[];
  };
};

const defaultFormState: StorageAccountWorkflowFormState = {
  accountName: 'devstorealpha01',
  resourceGroup: '',
  location: 'westus3',
  accountKind: 'StorageV2',
  accountTier: 'Standard',
  replicationType: 'LRS',
  accessTier: 'Hot',
  publicNetworkAccess: 'Enabled',
  minimumTlsVersion: 'TLS1_2',
  httpsTrafficOnlyEnabled: true,
  infrastructureEncryptionEnabled: true,
  sharedAccessKeyEnabled: true,
  allowNestedItemsToBePublic: false,
  crossTenantReplicationEnabled: true,
  defaultToOauthAuthentication: false,
  isHnsEnabled: false,
  largeFileShareEnabled: false,
  localUserEnabled: true,
  nfsv3Enabled: false,
  sftpEnabled: false,
  allowedCopyScope: '',
};

const premiumOnlyAccountKinds: AccountKind[] = [
  'BlockBlobStorage',
  'FileStorage',
];
const accessTierAccountKinds: AccountKind[] = [
  'BlobStorage',
  'FileStorage',
  'StorageV2',
];

type AzureStorageAccountWorkflowProps = {
  onBackToCatalog?: () => void;
};

export default function AzureStorageAccountWorkflow({
  onBackToCatalog,
}: AzureStorageAccountWorkflowProps) {
  const [formState, setFormState] = useState(defaultFormState);
  const [approvedResourceGroups, setApprovedResourceGroups] = useState<
    string[]
  >([]);
  const [resourceGroupsLoading, setResourceGroupsLoading] = useState(true);
  const [resourceGroupsError, setResourceGroupsError] = useState<string | null>(
    null
  );
  const [createLoading, setCreateLoading] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const requiresPremiumTier = premiumOnlyAccountKinds.includes(
    formState.accountKind
  );
  const supportsAccessTier = accessTierAccountKinds.includes(
    formState.accountKind
  );

  useEffect(() => {
    let isActive = true;

    async function loadApprovedResourceGroups() {
      setResourceGroupsLoading(true);
      setResourceGroupsError(null);

      try {
        const response = await fetch(
          '/api/crossplane/resources?group=azure.m.upbound.io&version=v1beta1&plural=resourcegroups'
        );
        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.error || 'Failed to load approved resource groups'
          );
        }

        const readyResourceGroups = (
          (data.data || []) as CrossplaneResourceGroup[]
        )
          .filter((item) =>
            item.status?.conditions?.some(
              (condition) =>
                condition.type === 'Ready' && condition.status === 'True'
            )
          )
          .map((item) => item.metadata?.name)
          .filter((name): name is string => Boolean(name));

        if (!isActive) {
          return;
        }

        setApprovedResourceGroups(readyResourceGroups);

        if (readyResourceGroups.length === 0) {
          setResourceGroupsError(
            'No approved resource groups are currently ready for storage provisioning.'
          );
          setFormState((current) => ({
            ...current,
            resourceGroup: '',
          }));
          return;
        }

        setFormState((current) => ({
          ...current,
          resourceGroup: readyResourceGroups.includes(current.resourceGroup)
            ? current.resourceGroup
            : readyResourceGroups[0],
        }));
      } catch (resourceGroupLoadError: unknown) {
        if (!isActive) {
          return;
        }

        setApprovedResourceGroups([]);
        setFormState((current) => ({
          ...current,
          resourceGroup: '',
        }));
        setResourceGroupsError(
          resourceGroupLoadError instanceof Error
            ? resourceGroupLoadError.message
            : 'Failed to load approved resource groups.'
        );
      } finally {
        if (isActive) {
          setResourceGroupsLoading(false);
        }
      }
    }

    void loadApprovedResourceGroups();

    return () => {
      isActive = false;
    };
  }, []);

  const handleFieldChange =
    (field: keyof StorageAccountWorkflowFormState) =>
    (
      event:
        | React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
        | { target: { value: string } }
    ) => {
      setFormState((current) => {
        const nextState = {
          ...current,
          [field]: event.target.value,
        } as StorageAccountWorkflowFormState;

        if (field === 'accountKind') {
          if (premiumOnlyAccountKinds.includes(nextState.accountKind)) {
            nextState.accountTier = 'Premium';
          }

          if (!accessTierAccountKinds.includes(nextState.accountKind)) {
            nextState.accessTier = defaultFormState.accessTier;
          }
        }

        return nextState;
      });
    };

  const handleBooleanFieldChange =
    (field: keyof StorageAccountWorkflowFormState) =>
    (_event: React.ChangeEvent<HTMLInputElement>, checked: boolean) => {
      setFormState((current) => {
        const nextState: StorageAccountWorkflowFormState = {
          ...current,
          [field]: checked,
        } as StorageAccountWorkflowFormState;

        if (field === 'sftpEnabled' && checked) {
          nextState.isHnsEnabled = true;
          nextState.localUserEnabled = true;
        }

        if (field === 'nfsv3Enabled' && checked) {
          nextState.isHnsEnabled = true;
        }

        if (field === 'isHnsEnabled' && !checked) {
          nextState.sftpEnabled = false;
          nextState.nfsv3Enabled = false;
        }

        if (field === 'localUserEnabled' && !checked && current.sftpEnabled) {
          nextState.localUserEnabled = true;
        }

        return nextState;
      });
    };

  const advancedSelections = [
    formState.accountKind !== defaultFormState.accountKind,
    formState.minimumTlsVersion !== defaultFormState.minimumTlsVersion,
    formState.allowedCopyScope !== defaultFormState.allowedCopyScope,
    formState.httpsTrafficOnlyEnabled !==
      defaultFormState.httpsTrafficOnlyEnabled,
    formState.infrastructureEncryptionEnabled !==
      defaultFormState.infrastructureEncryptionEnabled,
    formState.sharedAccessKeyEnabled !==
      defaultFormState.sharedAccessKeyEnabled,
    formState.allowNestedItemsToBePublic !==
      defaultFormState.allowNestedItemsToBePublic,
    formState.crossTenantReplicationEnabled !==
      defaultFormState.crossTenantReplicationEnabled,
    formState.defaultToOauthAuthentication !==
      defaultFormState.defaultToOauthAuthentication,
    formState.isHnsEnabled !== defaultFormState.isHnsEnabled,
    formState.largeFileShareEnabled !== defaultFormState.largeFileShareEnabled,
    formState.localUserEnabled !== defaultFormState.localUserEnabled,
    formState.nfsv3Enabled !== defaultFormState.nfsv3Enabled,
    formState.sftpEnabled !== defaultFormState.sftpEnabled,
  ].filter(Boolean).length;

  const validationMessages: ValidationMessage[] = [];

  if (requiresPremiumTier) {
    validationMessages.push({
      severity: 'info',
      message:
        'Premium is required for BlockBlobStorage and FileStorage accounts.',
    });
  }

  if (!supportsAccessTier) {
    validationMessages.push({
      severity: 'info',
      message:
        'Access tier only applies to BlobStorage, FileStorage, and StorageV2 accounts.',
    });
  }

  if (formState.sftpEnabled) {
    validationMessages.push({
      severity: 'info',
      message:
        'SFTP requires hierarchical namespace and local users, so those settings stay enabled while SFTP is on.',
    });
  }

  if (formState.nfsv3Enabled) {
    validationMessages.push({
      severity: 'info',
      message:
        'NFSv3 requires hierarchical namespace and will keep it enabled.',
    });
  }

  if (
    !formState.sharedAccessKeyEnabled &&
    !formState.defaultToOauthAuthentication
  ) {
    validationMessages.push({
      severity: 'warning',
      message:
        'Shared key access is disabled. Clients will need Microsoft Entra-based authentication or another identity-aware path.',
    });
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!formState.resourceGroup) {
      setError('Select an approved resource group before submitting.');
      return;
    }

    setCreateLoading(true);
    setError(null);
    setSuccess(null);

    const payload = {
      group: 'storage.azure.upbound.io',
      version: 'v1beta1',
      plural: 'accounts',
      payload: {
        apiVersion: storageAccountApiVersion,
        kind: storageAccountKind,
        metadata: {
          name: formState.accountName,
        },
        spec: {
          providerConfigRef: {
            name: 'default',
          },
          forProvider: {
            location: formState.location,
            resourceGroupName: formState.resourceGroup,
            accountKind: formState.accountKind,
            accountTier: formState.accountTier,
            accountReplicationType: formState.replicationType,
            ...(supportsAccessTier ? { accessTier: formState.accessTier } : {}),
            minTlsVersion: formState.minimumTlsVersion,
            httpsTrafficOnlyEnabled: formState.httpsTrafficOnlyEnabled,
            publicNetworkAccessEnabled:
              formState.publicNetworkAccess === 'Enabled',
            sharedAccessKeyEnabled: formState.sharedAccessKeyEnabled,
            allowNestedItemsToBePublic: formState.allowNestedItemsToBePublic,
            infrastructureEncryptionEnabled:
              formState.infrastructureEncryptionEnabled,
            crossTenantReplicationEnabled:
              formState.crossTenantReplicationEnabled,
            defaultToOauthAuthentication:
              formState.defaultToOauthAuthentication,
            isHnsEnabled: formState.isHnsEnabled,
            largeFileShareEnabled: formState.largeFileShareEnabled,
            localUserEnabled: formState.localUserEnabled,
            nfsv3Enabled: formState.nfsv3Enabled,
            sftpEnabled: formState.sftpEnabled,
            ...(formState.allowedCopyScope
              ? { allowedCopyScope: formState.allowedCopyScope }
              : {}),
          },
        },
      },
    };

    try {
      const response = await fetch('/api/crossplane/resources', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create Azure Storage account');
      }

      const createdName = data.data?.metadata?.name || formState.accountName;
      setSuccess(`Successfully submitted storage account: ${createdName}`);
    } catch (submissionError: unknown) {
      if (submissionError instanceof Error) {
        setError(submissionError.message);
      } else {
        setError(String(submissionError));
      }
    } finally {
      setCreateLoading(false);
    }
  };

  return (
    <Card elevation={0}>
      <CardContent sx={{ p: { xs: 3, md: 4 } }}>
        <Stack spacing={3}>
          <Stack spacing={1.25}>
            {onBackToCatalog ? (
              <Box>
                <Button variant="text" onClick={onBackToCatalog}>
                  Back to catalog
                </Button>
              </Box>
            ) : null}
            <Typography
              variant="overline"
              component="h4"
              sx={{ letterSpacing: '0.12em', color: 'text.secondary' }}
            >
              Storage Service
            </Typography>
            <Typography variant="h5" component="h3" sx={{ fontWeight: 600 }}>
              Create Azure Storage Account
            </Typography>
            <Stack
              direction="row"
              spacing={1}
              useFlexGap
              sx={{ flexWrap: 'wrap' }}
            >
              <Chip label="Platform-managed" size="small" color="primary" />
              <Chip
                label="Security defaults applied"
                size="small"
                variant="outlined"
              />
              <Chip
                label="Advanced mode available"
                size="small"
                variant="outlined"
              />
              <Chip
                label="Provisioned through the catalog"
                size="small"
                variant="outlined"
              />
            </Stack>
            <Typography
              variant="body1"
              color="text.secondary"
              sx={{ maxWidth: 760 }}
            >
              Request a governed Azure Storage account without dealing with
              provider manifests or cluster-side orchestration. The platform
              applies secure defaults for most teams while still giving advanced
              users a clean path to tune protocol, identity, and encryption
              settings when they need tighter control.
            </Typography>
            <Accordion
              disableGutters
              elevation={0}
              sx={{
                borderRadius: 3,
                border: '1px solid',
                borderColor: 'divider',
                backgroundColor: 'action.hover',
              }}
            >
              <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />}>
                <Stack spacing={0.5}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    Technical implementation details
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Platform engineers can review the managed Crossplane
                    resource identity used behind this request.
                  </Typography>
                </Stack>
              </AccordionSummary>
              <AccordionDetails>
                <Stack
                  direction={{ xs: 'column', md: 'row' }}
                  spacing={1.5}
                  useFlexGap
                  sx={{ flexWrap: 'wrap' }}
                >
                  <Box
                    sx={{
                      px: 1.5,
                      py: 1.25,
                      borderRadius: 999,
                      border: '1px solid',
                      borderColor: 'divider',
                      backgroundColor: 'background.paper',
                    }}
                  >
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography
                        variant="caption"
                        sx={{
                          color: 'text.secondary',
                          fontWeight: 700,
                          letterSpacing: '0.08em',
                        }}
                      >
                        apiVersion
                      </Typography>
                      <Chip
                        label={storageAccountApiVersion}
                        size="small"
                        sx={{
                          fontFamily: 'var(--font-geist-mono)',
                          fontSize: '0.72rem',
                          backgroundColor: 'rgba(138, 180, 248, 0.18)',
                          color: 'primary.main',
                        }}
                      />
                    </Stack>
                  </Box>

                  <Box
                    sx={{
                      px: 1.5,
                      py: 1.25,
                      borderRadius: 999,
                      border: '1px solid',
                      borderColor: 'divider',
                      backgroundColor: 'background.paper',
                    }}
                  >
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography
                        variant="caption"
                        sx={{
                          color: 'text.secondary',
                          fontWeight: 700,
                          letterSpacing: '0.08em',
                        }}
                      >
                        Kind
                      </Typography>
                      <Chip
                        label={storageAccountKind}
                        size="small"
                        sx={{
                          fontFamily: 'var(--font-geist-mono)',
                          fontSize: '0.72rem',
                          backgroundColor: 'rgba(129, 201, 149, 0.16)',
                          color: 'secondary.main',
                        }}
                      />
                    </Stack>
                  </Box>
                </Stack>
              </AccordionDetails>
            </Accordion>
          </Stack>

          <form onSubmit={handleSubmit}>
            <Stack spacing={2.5}>
              <TextField
                label="Storage account name"
                value={formState.accountName}
                onChange={handleFieldChange('accountName')}
                helperText="Use a globally unique lowercase name with numbers only if needed."
                required
                slotProps={{
                  htmlInput: {
                    pattern: '[a-z0-9]{3,24}',
                    minLength: 3,
                    maxLength: 24,
                  },
                }}
              />

              <FormControl
                fullWidth
                required
                error={Boolean(resourceGroupsError)}
              >
                <InputLabel id="storage-resource-group-label">
                  Resource group
                </InputLabel>
                <Select
                  labelId="storage-resource-group-label"
                  label="Resource group"
                  value={formState.resourceGroup}
                  onChange={handleFieldChange('resourceGroup')}
                  disabled={
                    resourceGroupsLoading || approvedResourceGroups.length === 0
                  }
                >
                  {approvedResourceGroups.map((resourceGroup) => (
                    <MenuItem key={resourceGroup} value={resourceGroup}>
                      {resourceGroup}
                    </MenuItem>
                  ))}
                </Select>
                <FormHelperText>
                  {resourceGroupsError ||
                    'Only approved resource groups surfaced by the platform can be targeted.'}
                </FormHelperText>
              </FormControl>

              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                <FormControl fullWidth>
                  <InputLabel id="storage-location-label">Location</InputLabel>
                  <Select
                    labelId="storage-location-label"
                    label="Location"
                    value={formState.location}
                    onChange={handleFieldChange('location')}
                  >
                    <MenuItem value="westus3">West US 3</MenuItem>
                    <MenuItem value="eastus2">East US 2</MenuItem>
                    <MenuItem value="centralus">Central US</MenuItem>
                  </Select>
                </FormControl>

                <FormControl fullWidth>
                  <InputLabel id="storage-kind-label">Account kind</InputLabel>
                  <Select
                    labelId="storage-kind-label"
                    label="Account kind"
                    value={formState.accountKind}
                    onChange={handleFieldChange('accountKind')}
                  >
                    <MenuItem value="StorageV2">StorageV2</MenuItem>
                    <MenuItem value="BlobStorage">BlobStorage</MenuItem>
                    <MenuItem value="BlockBlobStorage">
                      BlockBlobStorage
                    </MenuItem>
                    <MenuItem value="FileStorage">FileStorage</MenuItem>
                    <MenuItem value="Storage">Storage</MenuItem>
                  </Select>
                </FormControl>

                <FormControl fullWidth>
                  <InputLabel id="storage-tier-label">Account tier</InputLabel>
                  <Select
                    labelId="storage-tier-label"
                    label="Account tier"
                    value={formState.accountTier}
                    onChange={handleFieldChange('accountTier')}
                    disabled={requiresPremiumTier}
                  >
                    <MenuItem value="Standard">Standard</MenuItem>
                    <MenuItem value="Premium">Premium</MenuItem>
                  </Select>
                  <FormHelperText>
                    {requiresPremiumTier
                      ? 'Premium is required for the selected account kind.'
                      : 'Choose the performance tier that matches the workload.'}
                  </FormHelperText>
                </FormControl>
              </Stack>

              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                <FormControl fullWidth>
                  <InputLabel id="storage-replication-label">
                    Replication
                  </InputLabel>
                  <Select
                    labelId="storage-replication-label"
                    label="Replication"
                    value={formState.replicationType}
                    onChange={handleFieldChange('replicationType')}
                  >
                    <MenuItem value="LRS">LRS</MenuItem>
                    <MenuItem value="ZRS">ZRS</MenuItem>
                    <MenuItem value="GRS">GRS</MenuItem>
                  </Select>
                </FormControl>

                <FormControl fullWidth>
                  <InputLabel id="storage-access-tier-label">
                    Access tier
                  </InputLabel>
                  <Select
                    labelId="storage-access-tier-label"
                    label="Access tier"
                    value={formState.accessTier}
                    onChange={handleFieldChange('accessTier')}
                    disabled={!supportsAccessTier}
                  >
                    <MenuItem value="Hot">Hot</MenuItem>
                    <MenuItem value="Cool">Cool</MenuItem>
                  </Select>
                  <FormHelperText>
                    {supportsAccessTier
                      ? 'Optimize for frequent access or lower-cost infrequent access.'
                      : 'This account kind does not expose access tier selection.'}
                  </FormHelperText>
                </FormControl>

                <FormControl fullWidth>
                  <InputLabel id="storage-public-network-label">
                    Public network access
                  </InputLabel>
                  <Select
                    labelId="storage-public-network-label"
                    label="Public network access"
                    value={formState.publicNetworkAccess}
                    onChange={handleFieldChange('publicNetworkAccess')}
                  >
                    <MenuItem value="Enabled">Enabled</MenuItem>
                    <MenuItem value="Disabled">Disabled</MenuItem>
                  </Select>
                </FormControl>
              </Stack>

              <Accordion
                disableGutters
                elevation={0}
                expanded={advancedOpen}
                onChange={(_event, expanded) => setAdvancedOpen(expanded)}
                sx={{
                  borderRadius: 3,
                  border: '1px solid',
                  borderColor: advancedOpen ? 'primary.main' : 'divider',
                  backgroundColor: advancedOpen
                    ? 'rgba(138, 180, 248, 0.08)'
                    : 'background.paper',
                  overflow: 'hidden',
                }}
              >
                <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />}>
                  <Stack spacing={0.75} sx={{ width: '100%' }}>
                    <Stack
                      direction="row"
                      justifyContent="space-between"
                      alignItems={{ xs: 'flex-start', md: 'center' }}
                      spacing={1.5}
                      useFlexGap
                      sx={{ width: '100%', pr: 1 }}
                    >
                      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                        Advanced configuration
                      </Typography>
                      {advancedSelections > 0 ? (
                        <Chip
                          size="small"
                          color="primary"
                          label={`${advancedSelections} customizations`}
                          sx={{ alignSelf: { xs: 'flex-start', md: 'center' } }}
                        />
                      ) : null}
                    </Stack>
                    <Typography variant="body2" color="text.secondary">
                      Tune advanced security, identity, and protocol controls
                      without leaving the guided workflow.
                    </Typography>
                  </Stack>
                </AccordionSummary>
                <AccordionDetails>
                  <Stack spacing={3}>
                    {validationMessages.length > 0 ? (
                      <Stack spacing={1.25}>
                        {validationMessages.map((item) => (
                          <Alert
                            key={item.message}
                            severity={item.severity}
                            variant="outlined"
                          >
                            {item.message}
                          </Alert>
                        ))}
                      </Stack>
                    ) : null}

                    <Stack spacing={1.5}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                        Security and identity
                      </Typography>
                      <Stack
                        direction={{ xs: 'column', md: 'row' }}
                        spacing={2}
                      >
                        <FormControl fullWidth>
                          <InputLabel id="storage-min-tls-version-label">
                            Minimum TLS version
                          </InputLabel>
                          <Select
                            labelId="storage-min-tls-version-label"
                            label="Minimum TLS version"
                            value={formState.minimumTlsVersion}
                            onChange={handleFieldChange('minimumTlsVersion')}
                          >
                            <MenuItem value="TLS1_0">TLS1_0</MenuItem>
                            <MenuItem value="TLS1_1">TLS1_1</MenuItem>
                            <MenuItem value="TLS1_2">TLS1_2</MenuItem>
                          </Select>
                        </FormControl>

                        <FormControl fullWidth>
                          <InputLabel id="storage-allowed-copy-scope-label">
                            Allowed copy scope
                          </InputLabel>
                          <Select
                            labelId="storage-allowed-copy-scope-label"
                            label="Allowed copy scope"
                            value={formState.allowedCopyScope}
                            onChange={handleFieldChange('allowedCopyScope')}
                          >
                            <MenuItem value="">Platform default</MenuItem>
                            <MenuItem value="AAD">AAD tenant only</MenuItem>
                            <MenuItem value="PrivateLink">
                              Private Link
                            </MenuItem>
                          </Select>
                        </FormControl>
                      </Stack>

                      <Stack spacing={0.5}>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={formState.defaultToOauthAuthentication}
                              onChange={handleBooleanFieldChange(
                                'defaultToOauthAuthentication'
                              )}
                            />
                          }
                          label="Default to Microsoft Entra authorization"
                        />
                        <FormControlLabel
                          control={
                            <Switch
                              checked={!formState.sharedAccessKeyEnabled}
                              onChange={(_event, checked) => {
                                setFormState((current) => ({
                                  ...current,
                                  sharedAccessKeyEnabled: !checked,
                                }));
                              }}
                            />
                          }
                          label="Disable shared key access"
                        />
                        <FormControlLabel
                          control={
                            <Switch
                              checked={formState.httpsTrafficOnlyEnabled}
                              onChange={handleBooleanFieldChange(
                                'httpsTrafficOnlyEnabled'
                              )}
                            />
                          }
                          label="Require HTTPS-only traffic"
                        />
                        <FormControlLabel
                          control={
                            <Switch
                              checked={
                                formState.infrastructureEncryptionEnabled
                              }
                              onChange={handleBooleanFieldChange(
                                'infrastructureEncryptionEnabled'
                              )}
                            />
                          }
                          label="Enable infrastructure encryption"
                        />
                        <FormControlLabel
                          control={
                            <Switch
                              checked={formState.crossTenantReplicationEnabled}
                              onChange={handleBooleanFieldChange(
                                'crossTenantReplicationEnabled'
                              )}
                            />
                          }
                          label="Allow cross-tenant replication"
                        />
                        <FormControlLabel
                          control={
                            <Switch
                              checked={formState.allowNestedItemsToBePublic}
                              onChange={handleBooleanFieldChange(
                                'allowNestedItemsToBePublic'
                              )}
                            />
                          }
                          label="Allow nested items to be made public"
                        />
                      </Stack>
                    </Stack>

                    <Divider />

                    <Stack spacing={1.5}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                        Protocols and data plane capabilities
                      </Typography>
                      <Stack spacing={0.5}>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={formState.isHnsEnabled}
                              onChange={handleBooleanFieldChange(
                                'isHnsEnabled'
                              )}
                            />
                          }
                          label="Hierarchical namespace"
                        />
                        <FormHelperText sx={{ ml: 1 }}>
                          Required for Data Lake Gen2 scenarios and
                          automatically enabled when SFTP or NFSv3 is selected.
                        </FormHelperText>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={formState.largeFileShareEnabled}
                              onChange={handleBooleanFieldChange(
                                'largeFileShareEnabled'
                              )}
                            />
                          }
                          label="Enable large file shares"
                        />
                        <FormControlLabel
                          control={
                            <Switch
                              checked={!formState.localUserEnabled}
                              onChange={(_event, checked) => {
                                setFormState((current) => ({
                                  ...current,
                                  localUserEnabled: checked ? false : true,
                                }));
                              }}
                              disabled={formState.sftpEnabled}
                            />
                          }
                          label="Disable local users"
                        />
                        <FormControlLabel
                          control={
                            <Switch
                              checked={formState.sftpEnabled}
                              onChange={handleBooleanFieldChange('sftpEnabled')}
                            />
                          }
                          label="Enable SFTP"
                        />
                        <FormControlLabel
                          control={
                            <Switch
                              checked={formState.nfsv3Enabled}
                              onChange={handleBooleanFieldChange(
                                'nfsv3Enabled'
                              )}
                            />
                          }
                          label="Enable NFSv3"
                        />
                      </Stack>
                    </Stack>
                  </Stack>
                </AccordionDetails>
              </Accordion>

              <Box>
                <Button
                  type="submit"
                  variant="contained"
                  disableElevation
                  disabled={
                    createLoading ||
                    resourceGroupsLoading ||
                    approvedResourceGroups.length === 0
                  }
                  startIcon={
                    createLoading ? (
                      <CircularProgress size={18} color="inherit" />
                    ) : (
                      <AddCircleOutlineRoundedIcon />
                    )
                  }
                >
                  {createLoading
                    ? 'Submitting storage account...'
                    : 'Create Storage Account'}
                </Button>
              </Box>
            </Stack>
          </form>

          {error && <Alert severity="error">{error}</Alert>}
          {success && <Alert severity="success">{success}</Alert>}
        </Stack>
      </CardContent>
    </Card>
  );
}
