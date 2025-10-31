import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  Alert,
  CircularProgress,
  Typography,
} from '@mui/material';
import { useAuth } from '../services/authService';

interface LoginDialogProps {
  open: boolean;
  onClose: () => void;
  onLoginSuccess: () => void;
}

export const LoginDialog: React.FC<LoginDialogProps> = ({
  open,
  onClose,
  onLoginSuccess,
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const { login, isLoading, error } = useAuth();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    
    if (!username.trim() || !password.trim()) {
      return;
    }

    try {
      await login(username, password);
      onLoginSuccess();
      onClose();
      // Clear form
      setUsername('');
      setPassword('');
    } catch (error) {
      // Error is handled by the useAuth hook
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      onClose();
      // Clear form on close
      setUsername('');
      setPassword('');
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleClose} 
      maxWidth="sm" 
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          boxShadow: 24
        }
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              bgcolor: 'primary.main',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Typography variant="h5" sx={{ color: 'white' }}>🔐</Typography>
          </Box>
          <Box>
            <Typography variant="h6" component="div" sx={{ fontWeight: 600 }}>
              Login to SQL REST API
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Secure authentication required
            </Typography>
          </Box>
        </Box>
      </DialogTitle>
      
      <form onSubmit={handleSubmit}>
        <DialogContent sx={{ pt: 3 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 300 }}>
            {error && (
              <Alert 
                severity="error" 
                onClose={() => {}}
                sx={{ borderRadius: 2 }}
              >
                {error}
              </Alert>
            )}
            
            <TextField
              autoFocus
              label="Username"
              type="text"
              fullWidth
              variant="outlined"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isLoading}
              required
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2
                }
              }}
            />
            
            <TextField
              label="Password"
              type="password"
              fullWidth
              variant="outlined"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              required
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2
                }
              }}
            />

            <Box 
              sx={{ 
                bgcolor: 'info.lighter', 
                p: 2, 
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'info.light'
              }}
            >
              <Typography variant="body2" color="info.dark" sx={{ fontWeight: 500 }}>
                💡 Default Credentials
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                Username: <strong>admin</strong> | Password: <strong>admin</strong>
              </Typography>
            </Box>
          </Box>
        </DialogContent>
        
        <DialogActions sx={{ px: 3, pb: 3, pt: 2 }}>
          <Button 
            onClick={handleClose} 
            disabled={isLoading}
            sx={{ 
              borderRadius: 2,
              textTransform: 'none',
              px: 3
            }}
          >
            Cancel
          </Button>
          <Button 
            type="submit" 
            variant="contained" 
            disabled={isLoading || !username.trim() || !password.trim()}
            startIcon={isLoading ? <CircularProgress size={20} /> : null}
            sx={{
              borderRadius: 2,
              textTransform: 'none',
              px: 4,
              py: 1,
              fontWeight: 600,
              boxShadow: 2,
              '&:hover': {
                boxShadow: 4
              }
            }}
          >
            {isLoading ? 'Logging in...' : 'Login'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};
