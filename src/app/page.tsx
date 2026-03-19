import { Container, Typography, Box } from '@mui/material';

export default function Home() {
  return (
    <Container maxWidth="lg">
      <Box sx={{ my: 4 }}>
        <Typography variant="h3" component="h1" gutterBottom>
          Internal Developer Portal
        </Typography>
        <Typography variant="body1">
          Platform engineering and Day 2 operations
        </Typography>
      </Box>
    </Container>
  );
}
