// JWT Authentication Service for Excel Grid
// Handles login, token storage, and authenticated API requests

export interface AuthResponse {
  token: string;
  expiresIn: number;
  tokenType: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  token: string | null;
  username: string | null;
  isLoading: boolean;
  error: string | null;
}

class AuthService {
  private token: string | null = null;
  private tokenExpiry: number | null = null;
  private refreshTimer: number | null = null;
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.loadTokenFromStorage();
  }

  // Add listener for auth state changes
  addListener(listener: () => void) {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  // Notify all listeners of auth state change
  private notifyListeners() {
    this.listeners.forEach(listener => listener());
  }

  // Load token from localStorage on initialization
  private loadTokenFromStorage(): void {
    try {
      const storedToken = localStorage.getItem('jwt_token');
      const storedExpiry = localStorage.getItem('jwt_expiry');

      if (storedToken && storedExpiry) {
        const expiry = parseInt(storedExpiry);
        if (Date.now() < expiry) {
          this.token = storedToken;
          this.tokenExpiry = expiry;
          this.scheduleTokenRefresh();
        } else {
          this.clearToken();
        }
      }
    } catch (error) {
      console.warn('Failed to load token from storage:', error);
      this.clearToken();
    }
  }

  // Save token to localStorage
  private saveTokenToStorage(token: string, expiresIn: number): void {
    try {
      const expiry = Date.now() + (expiresIn * 1000);
      localStorage.setItem('jwt_token', token);
      localStorage.setItem('jwt_expiry', expiry.toString());
      this.token = token;
      this.tokenExpiry = expiry;
      this.scheduleTokenRefresh();
      this.notifyListeners();
    } catch (error) {
      console.warn('Failed to save token to storage:', error);
    }
  }

  // Clear token from storage and memory
  private clearToken(): void {
    this.token = null;
    this.tokenExpiry = null;
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
    try {
      localStorage.removeItem('jwt_token');
      localStorage.removeItem('jwt_expiry');
      localStorage.removeItem('auth_username');
    } catch (error) {
      console.warn('Failed to clear token from storage:', error);
    }
    this.notifyListeners();
  }

  // Schedule token refresh before expiry
  private scheduleTokenRefresh(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }

    if (this.tokenExpiry) {
      const timeUntilExpiry = this.tokenExpiry - Date.now();
      const refreshTime = Math.max(0, timeUntilExpiry - (5 * 60 * 1000)); // Refresh 5 minutes before expiry

      this.refreshTimer = setTimeout(() => {
        console.warn('Token is about to expire. Please log in again.');
        this.logout();
      }, refreshTime);
    }
  }

  // Login with username and password
  async login(username: string, password: string): Promise<AuthResponse> {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Login failed');
      }

      const authResponse: AuthResponse = await response.json();
      
      // Save token and username
      this.saveTokenToStorage(authResponse.token, authResponse.expiresIn);
      localStorage.setItem('auth_username', username);

      return authResponse;
    } catch (error) {
      this.clearToken();
      throw error;
    }
  }

  // Logout and clear token
  logout(): void {
    this.clearToken();
  }

  // Get current authentication state
  getAuthState(): AuthState {
    const isTokenValid = this.token && this.tokenExpiry && Date.now() < this.tokenExpiry;
    return {
      isAuthenticated: !!isTokenValid,
      token: this.token,
      username: localStorage.getItem('auth_username'),
      isLoading: false,
      error: null,
    };
  }

  // Get authorization header for API requests
  getAuthHeader(): { Authorization: string } | Record<string, never> {
    if (this.token && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return { Authorization: `Bearer ${this.token}` };
    }
    return {};
  }

  // Check if token is expired
  isTokenExpired(): boolean {
    return !this.tokenExpiry || Date.now() >= this.tokenExpiry;
  }

  // Get token (for debugging)
  getToken(): string | null {
    return this.token;
  }
}

// Export singleton instance
export const authService = new AuthService();

// Export React hook for authentication state
export const useAuth = () => {
  const [authState, setAuthState] = React.useState<AuthState>(authService.getAuthState());

  React.useEffect(() => {
    // Subscribe to auth state changes
    const unsubscribe = authService.addListener(() => {
      setAuthState(authService.getAuthState());
    });

    return unsubscribe;
  }, []);

  const login = React.useCallback(async (username: string, password: string) => {
    setAuthState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      await authService.login(username, password);
      setAuthState(authService.getAuthState());
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Login failed';
      setAuthState(prev => ({ ...prev, isLoading: false, error: errorMessage }));
      throw error;
    }
  }, []);

  const logout = React.useCallback(() => {
    authService.logout();
    // State will be updated automatically by the listener
  }, []);

  return {
    ...authState,
    login,
    logout,
    getAuthHeader: authService.getAuthHeader.bind(authService),
  };
};

import React from 'react';
