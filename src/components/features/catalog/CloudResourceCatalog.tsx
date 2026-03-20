'use client';

import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Grid,
  LinearProgress,
  Stack,
  Typography,
} from '@mui/material';
import Link from 'next/link';
import HubOutlinedIcon from '@mui/icons-material/HubOutlined';
import StorageRoundedIcon from '@mui/icons-material/StorageRounded';
import DnsRoundedIcon from '@mui/icons-material/DnsRounded';
import DeviceHubRoundedIcon from '@mui/icons-material/DeviceHubRounded';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';

const catalogEntries = [
  {
    name: 'Azure Kubernetes Service',
    category: 'Compute platform',
    summary:
      'Low-cost clusters for the portal, Crossplane control plane, and tenant workloads.',
    owner: 'Platform Runtime',
    regions: '1 region',
    services: '2 clusters',
    monthlyCost: '$57',
    security: 'OIDC and workload identity enabled',
    health: 91,
    icon: <HubOutlinedIcon fontSize="small" />,
    actionLabel: 'Coming soon',
    href: null,
  },
  {
    name: 'Azure Storage',
    category: 'Storage',
    summary:
      'Blob and file storage backing state snapshots, documentation assets, and logs.',
    owner: 'Platform Runtime',
    regions: '1 region',
    services: '4 accounts',
    monthlyCost: '$19',
    security: '100% encryption with soft delete',
    health: 95,
    icon: <StorageRoundedIcon fontSize="small" />,
    actionLabel: 'Open Azure Storage Workflow',
    href: '/catalog/azure-storage',
  },
  {
    name: 'Azure Database for PostgreSQL',
    category: 'Data services',
    summary:
      'Flexible Server instances for portal state, metadata, and operational reporting.',
    owner: 'Persistence Guild',
    regions: '1 region',
    services: '3 servers',
    monthlyCost: '$38',
    security: 'Private access on 2 of 3 servers',
    health: 84,
    icon: <DnsRoundedIcon fontSize="small" />,
    actionLabel: 'Coming soon',
    href: null,
  },
  {
    name: 'Azure Virtual Network',
    category: 'Networking',
    summary:
      'Segmented hub-and-spoke network boundaries for ingress, AKS, and managed data services.',
    owner: 'Cloud Foundation',
    regions: '1 region',
    services: '5 VNets',
    monthlyCost: '$11',
    security: '96% NSG policy compliance',
    health: 97,
    icon: <DeviceHubRoundedIcon fontSize="small" />,
    actionLabel: 'Coming soon',
    href: null,
  },
];

const costWatchlist = [
  {
    label: 'AKS compute spend',
    detail:
      'Automatic system capacity remains inside credit budget, but add-on usage is trending upward.',
  },
  {
    label: 'PostgreSQL idle capacity',
    detail:
      'One dev Flexible Server is oversized for current traffic and can move down a SKU.',
  },
  {
    label: 'Blob retention growth',
    detail:
      'Diagnostic storage is the largest unplanned cost driver under the current credit cap.',
  },
];

const securitySignals = [
  'Public network access left enabled on one PostgreSQL server.',
  'Two AKS namespaces still need workload identity migration off static secrets.',
  'One virtual network subnet is missing the newest egress restriction policy.',
];

export default function CloudResourceCatalog() {
  return (
    <Grid container spacing={3}>
      <Grid size={{ xs: 12, xl: 8 }}>
        <Card elevation={0} sx={{ height: '100%' }}>
          <CardContent sx={{ p: { xs: 3, md: 4 } }}>
            <Stack spacing={3}>
              <Box>
                <Typography
                  variant="overline"
                  component="h2"
                  sx={{ letterSpacing: '0.12em', color: 'text.secondary' }}
                >
                  Catalog
                </Typography>
                <Typography
                  variant="h5"
                  component="h3"
                  sx={{ fontWeight: 600 }}
                >
                  Azure Resource Catalog
                </Typography>
                <Typography
                  variant="body1"
                  color="text.secondary"
                  sx={{ mt: 1, maxWidth: 760 }}
                >
                  Browse platform-owned services by control plane area, see
                  where they operate, and understand current cost, posture, and
                  health before opening a resource workflow.
                </Typography>
              </Box>

              <Grid container spacing={2}>
                {catalogEntries.map((entry) => {
                  const isWorkflowAvailable = Boolean(entry.href);

                  return (
                    <Grid key={entry.name} size={{ xs: 12, md: 6 }}>
                      <Box
                        sx={{
                          p: 2.5,
                          borderRadius: 3,
                          border: '1px solid',
                          borderColor: 'divider',
                          minHeight: 248,
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                        }}
                      >
                        <Stack spacing={2.5}>
                          <Stack
                            direction="row"
                            justifyContent="space-between"
                            spacing={2}
                          >
                            <Stack
                              direction="row"
                              spacing={1.5}
                              alignItems="center"
                            >
                              <Box
                                sx={{
                                  width: 36,
                                  height: 36,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  borderRadius: 2,
                                  color: 'primary.main',
                                  backgroundColor: 'rgba(138, 180, 248, 0.14)',
                                }}
                              >
                                {entry.icon}
                              </Box>
                              <Box>
                                <Typography
                                  variant="h6"
                                  component="h4"
                                  sx={{ fontWeight: 600 }}
                                >
                                  {entry.name}
                                </Typography>
                                <Typography
                                  variant="body2"
                                  color="text.secondary"
                                >
                                  {entry.category}
                                </Typography>
                              </Box>
                            </Stack>
                            <Chip
                              label={entry.owner}
                              size="small"
                              variant="outlined"
                            />
                          </Stack>

                          <Typography variant="body2" color="text.secondary">
                            {entry.summary}
                          </Typography>

                          <Grid container spacing={1.5}>
                            <Grid size={{ xs: 6 }}>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                Estate size
                              </Typography>
                              <Typography
                                variant="body2"
                                sx={{ fontWeight: 600 }}
                              >
                                {entry.services}
                              </Typography>
                            </Grid>
                            <Grid size={{ xs: 6 }}>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                Regions
                              </Typography>
                              <Typography
                                variant="body2"
                                sx={{ fontWeight: 600 }}
                              >
                                {entry.regions}
                              </Typography>
                            </Grid>
                            <Grid size={{ xs: 6 }}>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                Monthly cost
                              </Typography>
                              <Typography
                                variant="body2"
                                sx={{ fontWeight: 600 }}
                              >
                                {entry.monthlyCost}
                              </Typography>
                            </Grid>
                            <Grid size={{ xs: 6 }}>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                Security
                              </Typography>
                              <Typography
                                variant="body2"
                                sx={{ fontWeight: 600 }}
                              >
                                {entry.security}
                              </Typography>
                            </Grid>
                          </Grid>
                        </Stack>

                        <Stack spacing={2} sx={{ mt: 2.5 }}>
                          <Box>
                            <Stack
                              direction="row"
                              justifyContent="space-between"
                              sx={{ mb: 1 }}
                            >
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                Operational health
                              </Typography>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                {entry.health}%
                              </Typography>
                            </Stack>
                            <LinearProgress
                              variant="determinate"
                              value={entry.health}
                              sx={{
                                height: 8,
                                borderRadius: 999,
                                backgroundColor: 'action.hover',
                              }}
                            />
                          </Box>

                          <Box>
                            {entry.href ? (
                              <Button
                                fullWidth
                                component={Link}
                                href={entry.href}
                                variant="contained"
                                disableElevation
                                aria-label={entry.actionLabel}
                              >
                                {entry.actionLabel}
                              </Button>
                            ) : (
                              <Button
                                fullWidth
                                variant="outlined"
                                disabled={!isWorkflowAvailable}
                                aria-label={entry.actionLabel}
                              >
                                {entry.actionLabel}
                              </Button>
                            )}
                          </Box>
                        </Stack>
                      </Box>
                    </Grid>
                  );
                })}
              </Grid>
            </Stack>
          </CardContent>
        </Card>
      </Grid>

      <Grid size={{ xs: 12, xl: 4 }}>
        <Stack spacing={3}>
          <Card elevation={0}>
            <CardContent sx={{ p: 3 }}>
              <Stack spacing={2.5}>
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Box
                    sx={{
                      width: 36,
                      height: 36,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 2,
                      color: '#f9ab00',
                      backgroundColor: 'rgba(249, 171, 0, 0.14)',
                    }}
                  >
                    <TrendingUpIcon fontSize="small" />
                  </Box>
                  <Typography
                    variant="h6"
                    component="h3"
                    sx={{ fontWeight: 600 }}
                  >
                    Cost Watchlist
                  </Typography>
                </Stack>

                <Stack spacing={2} divider={<Divider flexItem />}>
                  {costWatchlist.map((item) => (
                    <Box key={item.label}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {item.label}
                      </Typography>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ mt: 0.5 }}
                      >
                        {item.detail}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              </Stack>
            </CardContent>
          </Card>

          <Card elevation={0}>
            <CardContent sx={{ p: 3 }}>
              <Stack spacing={2.5}>
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Box
                    sx={{
                      width: 36,
                      height: 36,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 2,
                      color: '#81c995',
                      backgroundColor: 'rgba(129, 201, 149, 0.16)',
                    }}
                  >
                    <ShieldOutlinedIcon fontSize="small" />
                  </Box>
                  <Typography
                    variant="h6"
                    component="h3"
                    sx={{ fontWeight: 600 }}
                  >
                    Security Posture
                  </Typography>
                </Stack>

                <Stack spacing={1.5}>
                  {securitySignals.map((signal) => (
                    <Box
                      key={signal}
                      sx={{
                        p: 2,
                        borderRadius: 2.5,
                        border: '1px solid',
                        borderColor: 'divider',
                      }}
                    >
                      <Typography variant="body2" color="text.secondary">
                        {signal}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        </Stack>
      </Grid>
    </Grid>
  );
}
