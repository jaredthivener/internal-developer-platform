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
import {
  serviceCatalogEntries,
  serviceCostWatchlist,
  serviceSecuritySignals,
} from '@/lib/catalog/servicePortfolio';

const catalogEntryIcons = {
  aks: <HubOutlinedIcon fontSize="small" />,
  storage: <StorageRoundedIcon fontSize="small" />,
  postgres: <DnsRoundedIcon fontSize="small" />,
  network: <DeviceHubRoundedIcon fontSize="small" />,
} as const;

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
                  Service Catalog
                </Typography>
                <Typography
                  variant="body1"
                  color="text.secondary"
                  sx={{ mt: 1, maxWidth: 760 }}
                >
                  Browse platform-owned services by control plane area, see
                  where they operate, and understand current cost, posture, and
                  health before opening a live workflow or reviewing a staged
                  service domain.
                </Typography>
              </Box>

              <Grid container spacing={2}>
                {serviceCatalogEntries.map((entry) => {
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
                                Estate size
                              </Typography>
                              <Typography
                                variant="body2"
                                sx={{ fontWeight: 600 }}
                              >
                                {entry.serviceCount}{' '}
                                {entry.serviceCount === 1
                                  ? 'service'
                                  : 'services'}
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
                                {entry.regionCount}{' '}
                                {entry.regionCount === 1 ? 'region' : 'regions'}
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
                    Cost Watchlist
                  </Typography>
                </Stack>

                <Stack spacing={2} divider={<Divider flexItem />}>
                  {serviceCostWatchlist.map((item) => (
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
                  {serviceSecuritySignals.map((signal) => (
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
