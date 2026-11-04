'use client';

import type { ReactNode } from 'react';
import {
  Box,
  Card,
  CardContent,
  Chip,
  Grid,
  Stack,
  Typography,
} from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import VerifiedOutlinedIcon from '@mui/icons-material/VerifiedOutlined';
import type { LivePortfolio } from '@/lib/catalog/livePortfolio';
import { serviceCatalogEntries } from '@/lib/catalog/servicePortfolio';

type MetricAccent = 'warning' | 'success' | 'error' | 'info';

type OverviewMetric = {
  label: string;
  value: string;
  detail: string;
  accent: MetricAccent;
  icon: ReactNode;
};

function buildOverviewMetrics({
  inventory,
  compliance,
}: LivePortfolio): OverviewMetric[] {
  const trackedResources = inventory
    ? serviceCatalogEntries.reduce(
        (total, entry) =>
          total + (inventory[entry.resourceType]?.resources ?? 0),
        0
      )
    : null;
  const { compliant, evaluated } = compliance?.overall ?? {
    compliant: 0,
    evaluated: 0,
  };

  return [
    {
      label: 'Catalog domains',
      value: String(serviceCatalogEntries.length),
      detail:
        'Compute, storage, data, and network services are tracked in one control surface.',
      accent: 'info',
      icon: <VerifiedOutlinedIcon fontSize="small" />,
    },
    {
      label: 'Live workflows',
      value: String(
        serviceCatalogEntries.filter(
          (entry) => entry.workflow.status === 'ready'
        ).length
      ),
      detail: 'Self-service workflows available in the catalog today.',
      accent: 'success',
      icon: <ShieldOutlinedIcon fontSize="small" />,
    },
    {
      label: 'Tracked resources',
      value: trackedResources === null ? '—' : String(trackedResources),
      detail:
        trackedResources === null
          ? 'Inventory is unavailable right now.'
          : 'Clusters, storage accounts, PostgreSQL servers, and virtual networks in the subscription, from Azure Resource Graph.',
      accent: 'warning',
      icon: <TrendingUpIcon fontSize="small" />,
    },
    {
      label: 'MCSB compliance',
      value:
        compliance && evaluated > 0
          ? `${Math.round((compliant / evaluated) * 100)}%`
          : '—',
      detail: !compliance
        ? 'Compliance data is unavailable right now.'
        : evaluated === 0
          ? 'Azure Policy has not finished its first evaluation yet.'
          : `${compliant} of ${evaluated} resources compliant with the ${compliance.framework}.`,
      accent: 'error',
      icon: <WarningAmberOutlinedIcon fontSize="small" />,
    },
  ];
}

const accentStyles = {
  warning: {
    color: '#f9ab00',
    backgroundColor: 'rgba(249, 171, 0, 0.14)',
  },
  success: {
    color: '#81c995',
    backgroundColor: 'rgba(129, 201, 149, 0.16)',
  },
  error: {
    color: '#f28b82',
    backgroundColor: 'rgba(242, 139, 130, 0.16)',
  },
  info: {
    color: '#8ab4f8',
    backgroundColor: 'rgba(138, 180, 248, 0.16)',
  },
} as const;

export default function CloudEstateOverview({
  portfolio,
}: {
  portfolio: LivePortfolio;
}) {
  const overviewMetrics = buildOverviewMetrics(portfolio);

  return (
    <Card elevation={0} sx={{ overflow: 'hidden' }}>
      <CardContent sx={{ p: { xs: 3, md: 4 } }}>
        <Stack spacing={3}>
          <Stack spacing={1.5}>
            <Chip
              label="Azure cloud estate"
              size="small"
              sx={{ alignSelf: 'flex-start', fontWeight: 600 }}
            />
            <Typography variant="h5" component="h2" sx={{ fontWeight: 600 }}>
              Cloud Estate Overview
            </Typography>
            <Typography
              variant="body1"
              color="text.secondary"
              sx={{ maxWidth: 720 }}
            >
              Platform-managed Azure footprint across compute, storage, data,
              and networking, read live from Azure. Use the catalog to inspect
              cost and compliance per service before opening a workflow.
            </Typography>
          </Stack>

          <Grid container spacing={2}>
            {overviewMetrics.map((metric) => (
              <Grid key={metric.label} size={{ xs: 12, sm: 6, xl: 3 }}>
                <Box
                  sx={{
                    p: 2.5,
                    borderRadius: 3,
                    border: '1px solid',
                    borderColor: 'divider',
                    background:
                      'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0) 100%)',
                    minHeight: 158,
                  }}
                >
                  <Stack spacing={2}>
                    <Box
                      sx={{
                        ...accentStyles[metric.accent],
                        width: 36,
                        height: 36,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: 2,
                      }}
                    >
                      {metric.icon}
                    </Box>
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        {metric.label}
                      </Typography>
                      <Typography
                        variant="h4"
                        component="p"
                        sx={{
                          fontWeight: 600,
                          letterSpacing: '-0.02em',
                          mt: 0.5,
                        }}
                      >
                        {metric.value}
                      </Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      {metric.detail}
                    </Typography>
                  </Stack>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Stack>
      </CardContent>
    </Card>
  );
}
