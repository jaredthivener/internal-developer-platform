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
import HubOutlinedIcon from '@mui/icons-material/HubOutlined';
import StorageRoundedIcon from '@mui/icons-material/StorageRounded';
import DnsRoundedIcon from '@mui/icons-material/DnsRounded';
import DeviceHubRoundedIcon from '@mui/icons-material/DeviceHubRounded';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import ButtonLink from '@/components/ui/ButtonLink';
import type {
  ComplianceCount,
  LivePortfolio,
} from '@/lib/catalog/livePortfolio';
import { serviceCatalogEntries } from '@/lib/catalog/servicePortfolio';

const catalogEntryIcons = {
  aks: <HubOutlinedIcon fontSize="small" />,
  storage: <StorageRoundedIcon fontSize="small" />,
  postgres: <DnsRoundedIcon fontSize="small" />,
  network: <DeviceHubRoundedIcon fontSize="small" />,
} as const;

const UNAVAILABLE = 'Unavailable';

function formatCost(amount: number, currency: string | null): string {
  return currency
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(
        amount
      )
    : amount.toFixed(2);
}

function compliancePercent({ compliant, evaluated }: ComplianceCount): number {
  return evaluated === 0 ? 0 : Math.round((compliant / evaluated) * 100);
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

export default function CloudResourceCatalog({
  portfolio,
}: {
  portfolio: LivePortfolio;
}) {
  const { inventory, cost, compliance } = portfolio;

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
                  Service Catalog
                </Typography>
                <Typography
                  variant="body1"
                  color="text.secondary"
                  sx={{ mt: 1, maxWidth: 760 }}
                >
                  Browse platform-owned services with live inventory and
                  month-to-date cost from Azure, and compliance against the{' '}
                  {compliance?.framework ??
                    'Microsoft cloud security benchmark v2'}
                  .
                </Typography>
              </Box>

              <Grid container spacing={2}>
                {serviceCatalogEntries.map((entry) => {
                  const isWorkflowAvailable = Boolean(entry.href);
                  const counts = inventory
                    ? (inventory[entry.resourceType] ?? {
                        resources: 0,
                        regions: 0,
                      })
                    : null;
                  const entryCompliance =
                    compliance?.byResourceType[entry.resourceType] ?? null;

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
                                {catalogEntryIcons[entry.icon]}
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
                            <Stack spacing={1} alignItems="flex-end">
                              <Chip
                                label={entry.owner}
                                size="small"
                                variant="outlined"
                              />
                              <Chip
                                label={
                                  entry.workflow.status === 'ready'
                                    ? 'Workflow ready'
                                    : 'Planned'
                                }
                                size="small"
                                color={
                                  entry.workflow.status === 'ready'
                                    ? 'success'
                                    : 'default'
                                }
                                variant={
                                  entry.workflow.status === 'ready'
                                    ? 'filled'
                                    : 'outlined'
                                }
                              />
                            </Stack>
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
                                Resources
                              </Typography>
                              <Typography
                                variant="body2"
                                sx={{ fontWeight: 600 }}
                              >
                                {counts
                                  ? plural(counts.resources, 'resource')
                                  : UNAVAILABLE}
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
                                {counts
                                  ? plural(counts.regions, 'region')
                                  : UNAVAILABLE}
                              </Typography>
                            </Grid>
                            <Grid size={{ xs: 6 }}>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                Cost, month to date
                              </Typography>
                              <Typography
                                variant="body2"
                                sx={{ fontWeight: 600 }}
                              >
                                {cost
                                  ? formatCost(
                                      cost.byResourceType[entry.resourceType] ??
                                        0,
                                      cost.currency
                                    )
                                  : UNAVAILABLE}
                              </Typography>
                            </Grid>
                            <Grid size={{ xs: 6 }}>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                Noncompliant resources
                              </Typography>
                              <Typography
                                variant="body2"
                                sx={{ fontWeight: 600 }}
                              >
                                {!compliance
                                  ? UNAVAILABLE
                                  : entryCompliance
                                    ? String(
                                        entryCompliance.evaluated -
                                          entryCompliance.compliant
                                      )
                                    : 'Not evaluated'}
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
                                MCSB compliance
                              </Typography>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                {entryCompliance
                                  ? `${compliancePercent(entryCompliance)}% (${entryCompliance.compliant} of ${plural(entryCompliance.evaluated, 'resource')})`
                                  : compliance
                                    ? 'Not evaluated'
                                    : UNAVAILABLE}
                              </Typography>
                            </Stack>
                            <LinearProgress
                              variant="determinate"
                              aria-label={`${entry.name} MCSB compliance`}
                              value={
                                entryCompliance
                                  ? compliancePercent(entryCompliance)
                                  : 0
                              }
                              sx={{
                                height: 8,
                                borderRadius: 999,
                                backgroundColor: 'action.hover',
                              }}
                            />
                          </Box>

                          <Box>
                            {entry.href ? (
                              <ButtonLink
                                fullWidth
                                href={entry.href}
                                variant="contained"
                                disableElevation
                                aria-label={entry.workflow.actionLabel}
                              >
                                {entry.workflow.actionLabel}
                              </ButtonLink>
                            ) : (
                              <Button
                                fullWidth
                                variant="outlined"
                                disabled={!isWorkflowAvailable}
                                aria-label={entry.workflow.actionLabel}
                              >
                                {entry.workflow.actionLabel}
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
                    Cost, month to date
                  </Typography>
                </Stack>

                {cost ? (
                  <Stack spacing={2} divider={<Divider flexItem />}>
                    <Box>
                      <Typography variant="h5" sx={{ fontWeight: 600 }}>
                        {formatCost(cost.total, cost.currency)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Subscription total from Azure Cost Management. Usage can
                        take up to a day to appear.
                      </Typography>
                    </Box>
                    {cost.topServices.map((item) => (
                      <Stack
                        key={item.service}
                        direction="row"
                        justifyContent="space-between"
                      >
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {item.service}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {formatCost(item.cost, cost.currency)}
                        </Typography>
                      </Stack>
                    ))}
                  </Stack>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    Cost data is unavailable right now.
                  </Typography>
                )}
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
                    Compliance
                  </Typography>
                </Stack>

                {!compliance ? (
                  <Typography variant="body2" color="text.secondary">
                    Compliance data is unavailable right now.
                  </Typography>
                ) : compliance.overall.evaluated === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    Azure Policy has not finished evaluating the{' '}
                    {compliance.framework} yet. The first scan can take about 30
                    minutes.
                  </Typography>
                ) : (
                  <Stack spacing={1.5}>
                    <Box>
                      <Typography variant="h5" sx={{ fontWeight: 600 }}>
                        {compliancePercent(compliance.overall)}%
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {compliance.overall.compliant} of{' '}
                        {plural(compliance.overall.evaluated, 'resource')}{' '}
                        compliant with the {compliance.framework}.
                      </Typography>
                    </Box>
                    {compliance.failingControls.map((control) => (
                      <Box
                        key={control.id}
                        sx={{
                          p: 2,
                          borderRadius: 2.5,
                          border: '1px solid',
                          borderColor: 'divider',
                        }}
                      >
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {control.title}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {plural(control.resources, 'noncompliant resource')}
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                )}
              </Stack>
            </CardContent>
          </Card>
        </Stack>
      </Grid>
    </Grid>
  );
}
