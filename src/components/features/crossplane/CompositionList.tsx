'use client';

import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Alert,
  Card,
  CardHeader,
  CardContent,
  Chip,
  IconButton,
} from '@mui/material';
import LayersIcon from '@mui/icons-material/Layers';
import RefreshIcon from '@mui/icons-material/Refresh';

// Define expected structure from the API
interface Composition {
  metadata: {
    name: string;
  };
  spec?: {
    compositeTypeRef?: {
      kind: string;
    };
  };
}

export default function CompositionList() {
  const [compositions, setCompositions] = useState<Composition[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCompositions = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/crossplane/compositions');
      if (!res.ok) {
        throw new Error('Failed to load compositions');
      }

      const data = await res.json();
      setCompositions(data.data || []);
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

  useEffect(() => {
    fetchCompositions();
  }, []);

  return (
    <Card elevation={0}>
      <CardHeader
        avatar={<LayersIcon color="primary" />}
        title={
          <Typography variant="h6" component="h2">
            Application Environments
          </Typography>
        }
        action={
          <IconButton
            onClick={fetchCompositions}
            title="Refresh"
            disabled={loading}
          >
            <RefreshIcon />
          </IconButton>
        }
        sx={{ borderBottom: '1px solid', borderColor: 'divider', pb: 2 }}
      />
      <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}>
            <CircularProgress size={32} />
          </Box>
        ) : error ? (
          <Box sx={{ p: 3 }}>
            <Alert severity="error">{error}</Alert>
          </Box>
        ) : (
          <TableContainer>
            <Table
              aria-label="application environments table"
              sx={{ minWidth: 500 }}
            >
              <TableHead sx={{ backgroundColor: 'background.default' }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>
                    App Platform
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>
                    Architecture Blueprint
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>
                    Status
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {compositions.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={3}
                      align="center"
                      sx={{ py: 4, color: 'text.secondary' }}
                    >
                      No application environments found.
                    </TableCell>
                  </TableRow>
                ) : (
                  compositions.map((comp) => (
                    <TableRow key={comp.metadata.name} hover>
                      <TableCell sx={{ fontWeight: 500 }}>
                        {comp.metadata.name}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={comp.spec?.compositeTypeRef?.kind || 'Unknown'}
                          size="small"
                          color="primary"
                          variant="outlined"
                          sx={{ fontWeight: 500 }}
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label="Available"
                          size="small"
                          color="success"
                          sx={{
                            backgroundColor: 'rgba(129, 201, 149, 0.16)',
                            color: '#81c995',
                            fontWeight: 500,
                          }}
                        />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </CardContent>
    </Card>
  );
}
