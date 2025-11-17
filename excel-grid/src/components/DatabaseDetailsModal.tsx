import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Chip,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from '@mui/material';
import {
  Storage,
  Schedule,
  Link,
  CheckCircle,
  Security,
  TableChart,
} from '@mui/icons-material';
import type { DatabaseMetadata, DatabaseChangeLogEntry } from '../types/cell';

interface DatabaseDetailsModalProps {
  open: boolean;
  onClose: () => void;
  databaseMetadata: DatabaseMetadata | null;
  changeLog?: DatabaseChangeLogEntry[];
}

export const DatabaseDetailsModal: React.FC<DatabaseDetailsModalProps> = ({
  open,
  onClose,
  databaseMetadata,
  changeLog = [],
}) => {
  if (!databaseMetadata) return null;

  const formatDate = (date: Date | string) => {
    const normalized = date instanceof Date ? date : new Date(date);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(normalized);
  };

  const getOperationColor = (operation: DatabaseChangeLogEntry['operation']) => {
    switch (operation) {
      case 'insert':
        return 'success';
      case 'update':
        return 'warning';
      case 'delete':
        return 'error';
      default:
        return 'default';
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Storage />
        Database Connection Details
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 1 }}>
          {/* Connection Status */}
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
              Connection Status
            </Typography>
            <Chip
              icon={databaseMetadata.isAuthenticated ? <CheckCircle /> : <Security />}
              label={databaseMetadata.isAuthenticated ? "Authenticated" : "Not Authenticated"}
              size="small"
              color={databaseMetadata.isAuthenticated ? "success" : "warning"}
              sx={{ mr: 1 }}
            />
          </Box>

          <Divider />

          {/* Table Information */}
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
              <TableChart fontSize="small" />
              Table Information
            </Typography>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
                gap: 2,
              }}
            >
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Schema:
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 'medium' }}>
                  {databaseMetadata.schema}
                </Typography>
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Table:
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 'medium' }}>
                  {databaseMetadata.table}
                </Typography>
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Display Name:
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 'medium' }}>
                  {databaseMetadata.displayName}
                </Typography>
              </Box>
            </Box>
          </Box>

          <Divider />

          {/* Connection Details */}
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
              <Link fontSize="small" />
              Connection Details
            </Typography>
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary">
                API Base URL:
              </Typography>
              <Typography variant="body1" sx={{ fontFamily: 'monospace', fontSize: '0.875rem', wordBreak: 'break-all' }}>
                {databaseMetadata.apiBaseUrl}
              </Typography>
            </Box>
          </Box>

          <Divider />

          {/* Import Information */}
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
              <Schedule fontSize="small" />
              Import Information
            </Typography>
            <Box>
              <Typography variant="body2" color="text.secondary">
                Import Time:
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 'medium' }}>
                {formatDate(databaseMetadata.importTime)}
              </Typography>
            </Box>
            <Box sx={{ mt: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Database ID:
              </Typography>
              <Typography variant="body1" sx={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
                {databaseMetadata.id}
              </Typography>
            </Box>
          </Box>

          <Divider />

          {/* Change Log */}
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 'bold' }}>
              Database Change Log
            </Typography>
            {changeLog.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No database changes recorded in this session.
              </Typography>
            ) : (
              <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 260 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ width: '35%' }}>Timestamp</TableCell>
                      <TableCell sx={{ width: '20%' }}>Operation</TableCell>
                      <TableCell sx={{ width: '20%' }}>Primary Key</TableCell>
                      <TableCell>Details</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {changeLog.map((entry) => (
                      <TableRow key={entry.id} hover>
                        <TableCell>{formatDate(entry.timestamp)}</TableCell>
                        <TableCell>
                          <Chip
                            label={entry.operation.toUpperCase()}
                            color={getOperationColor(entry.operation) as any}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>{entry.primaryKey ?? '—'}</TableCell>
                        <TableCell>
                          <Typography
                            variant="body2"
                            sx={{
                              fontFamily: 'monospace',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              maxWidth: 200,
                            }}
                          >
                            {entry.details ? JSON.stringify(entry.details) : '—'}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} variant="contained">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};
