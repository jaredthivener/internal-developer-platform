'use client';

import React, { useState } from 'react';
import {
  Typography,
  Button,
  Alert,
  CircularProgress,
  Stack,
  Card,
  CardHeader,
  CardContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';

export default function ResourceProvisioner() {
  const [region, setRegion] = useState('us-east-1');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    // Following our CrossplaneExpert.agent.md exact documentation specification
    const payload = {
      group: 's3.aws.m.upbound.io',
      version: 'v1beta1',
      plural: 'buckets',
      payload: {
        apiVersion: 's3.aws.m.upbound.io/v1beta1',
        kind: 'Bucket',
        metadata: {
          generateName: 'crossplane-bucket-',
        },
        spec: {
          forProvider: {
            region: region,
          },
          providerConfigRef: {
            name: 'default',
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
        throw new Error(data.error || 'Failed to provision resource');
      }

      setSuccess(
        `Successfully provisioned: ${data.data?.metadata?.name || 'Bucket'}`
      );
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(String(err));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card elevation={0}>
      <CardHeader
        avatar={<CloudUploadIcon color="primary" />}
        title={
          <Typography variant="h6" component="h2">
            Provision Application Base
          </Typography>
        }
        sx={{ borderBottom: '1px solid', borderColor: 'divider', pb: 2 }}
      />
      <CardContent sx={{ pt: 3 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Deploy a full application environment (EKS cluster, S3 storage, and
          PostgreSQL database). All underlying dependencies will be wired
          automatically.
        </Typography>

        <form onSubmit={handleSubmit}>
          <Stack spacing={3}>
            <FormControl fullWidth variant="outlined">
              <InputLabel id="region-select-label">Workspace Region</InputLabel>
              <Select
                labelId="region-select-label"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                label="Workspace Region"
                required
              >
                <MenuItem value="us-east-1">Americas (N. Virginia)</MenuItem>
                <MenuItem value="us-west-2">Americas (Oregon)</MenuItem>
                <MenuItem value="eu-west-1">Europe (Ireland)</MenuItem>
              </Select>
            </FormControl>

            <Divider />

            <Button
              type="submit"
              variant="contained"
              color="primary"
              disabled={loading}
              disableElevation
              startIcon={
                loading ? <CircularProgress size={20} color="inherit" /> : null
              }
              sx={{ py: 1.2 }}
            >
              {loading
                ? 'Orchestrating Architecture...'
                : 'Deploy App Environment'}
            </Button>
          </Stack>
        </form>

        {error && (
          <Alert severity="error" sx={{ mt: 3, borderRadius: 2 }}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" sx={{ mt: 3, borderRadius: 2 }}>
            {success}
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
