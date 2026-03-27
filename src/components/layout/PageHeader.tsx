import { Box, Stack, Typography } from '@mui/material';
import type { ReactNode } from 'react';

export const pageSectionSx = {
  maxWidth: 1440,
  margin: '0 auto',
  width: '100%',
} as const;

type PageHeaderProps = {
  title: string;
  description: string;
  action?: ReactNode;
  eyebrow?: ReactNode;
  stackSpacing?: number;
};

export default function PageHeader({
  title,
  description,
  action,
  eyebrow,
  stackSpacing = 1.25,
}: PageHeaderProps) {
  return (
    <Box
      sx={{
        mb: 4.5,
        px: { xs: 0.5, md: 0 },
      }}
    >
      <Stack spacing={stackSpacing}>
        {action ? <Box>{action}</Box> : null}
        {typeof eyebrow === 'string' ? (
          <Typography
            variant="overline"
            component="p"
            sx={{ letterSpacing: '0.12em', color: 'text.secondary' }}
          >
            {eyebrow}
          </Typography>
        ) : (
          (eyebrow ?? null)
        )}
        <Typography
          variant="h3"
          component="h1"
          sx={{
            fontWeight: 600,
            color: 'text.primary',
            letterSpacing: '-0.03em',
          }}
        >
          {title}
        </Typography>
        <Typography
          variant="body1"
          color="text.secondary"
          sx={{ maxWidth: 840 }}
        >
          {description}
        </Typography>
      </Stack>
    </Box>
  );
}
