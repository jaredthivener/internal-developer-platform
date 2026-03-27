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
import { getServicePortfolioSummary } from '@/lib/catalog/servicePortfolio';

type MetricAccent = 'warning' | 'success' | 'error' | 'info';

const portfolioSummary = getServicePortfolioSummary();

const overviewMetrics: Array<{
  label: string;
  value: string;
  detail: string;
  accent: MetricAccent;
  icon: ReactNode;
}> = [
  {
    label: 'Catalog domains',
    value: String(portfolioSummary.catalogDomainCount),
    detail:
      'Compute, storage, data, and network services are tracked in one control surface.',
    accent: 'info',
    icon: <VerifiedOutlinedIcon fontSize="small" />,
  },
  {
    label: 'Live workflows',
    value: String(portfolioSummary.liveWorkflowCount),
    detail:
      'Storage account provisioning is ready today while the remaining service workflows are staged.',
    accent: 'success',
    icon: <ShieldOutlinedIcon fontSize="small" />,
  },
  {
    label: 'Tracked services',
    value: String(portfolioSummary.trackedServiceCount),
    detail:
      'Clusters, accounts, servers, and networks currently represented in the estate.',
    accent: 'warning',
    icon: <TrendingUpIcon fontSize="small" />,
  },
  {
    label: 'Healthy domains',
    value: `${portfolioSummary.healthyDomainCount} / ${portfolioSummary.catalogDomainCount}`,
    detail:
      'Three service domains are currently operating at or above the portfolio health target.',
    accent: 'error',
    icon: <WarningAmberOutlinedIcon fontSize="small" />,
  },
];

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

export default function CloudEstateOverview() {
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
              and networking. Use the catalog below to inspect ownership,
              posture, and operating signals before drilling into the live
              storage workflow or the staged domains behind it.
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
