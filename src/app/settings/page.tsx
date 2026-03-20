import {
  Box,
  Card,
  CardContent,
  Divider,
  List,
  ListItem,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material';

const platformControls = [
  'Authentication remains enforced through Entra ID-backed sign-in.',
  'Offline mode is reserved for local workflow validation and demo previews.',
  'Crossplane provider access must stay scoped to approved provider configs.',
];

const environmentDefaults = [
  'Default storage workflows target the smoke-test resource group in West US 3.',
  'Provisioning requests should prefer managed identity over static secrets.',
  'Platform changes should pass lint, typecheck, and build before rollout.',
];

export default function SettingsPage() {
  return (
    <Box sx={{ maxWidth: 1440, margin: '0 auto', width: '100%' }}>
      <Box
        sx={{
          mb: 4.5,
          px: { xs: 0.5, md: 0 },
        }}
      >
        <Stack spacing={1.25}>
          <Typography
            variant="h3"
            component="h1"
            sx={{
              fontWeight: 600,
              color: 'text.primary',
              letterSpacing: '-0.03em',
            }}
          >
            Settings
          </Typography>
          <Typography
            variant="body1"
            color="text.secondary"
            sx={{ maxWidth: 840 }}
          >
            Manage platform access, delivery defaults, and environment
            guardrails for the portal experience.
          </Typography>
        </Stack>
      </Box>

      <Stack spacing={3}>
        <Card elevation={0}>
          <CardContent sx={{ p: 3 }}>
            <Stack spacing={2}>
              <Typography variant="h5" component="h2" sx={{ fontWeight: 600 }}>
                Platform Controls
              </Typography>
              <List disablePadding>
                {platformControls.map((item, index) => (
                  <Box key={item}>
                    <ListItem disableGutters>
                      <ListItemText primary={item} />
                    </ListItem>
                    {index < platformControls.length - 1 ? <Divider /> : null}
                  </Box>
                ))}
              </List>
            </Stack>
          </CardContent>
        </Card>

        <Card elevation={0}>
          <CardContent sx={{ p: 3 }}>
            <Stack spacing={2}>
              <Typography variant="h5" component="h2" sx={{ fontWeight: 600 }}>
                Environment Defaults
              </Typography>
              <List disablePadding>
                {environmentDefaults.map((item, index) => (
                  <Box key={item}>
                    <ListItem disableGutters>
                      <ListItemText primary={item} />
                    </ListItem>
                    {index < environmentDefaults.length - 1 ? (
                      <Divider />
                    ) : null}
                  </Box>
                ))}
              </List>
            </Stack>
          </CardContent>
        </Card>
      </Stack>
    </Box>
  );
}
