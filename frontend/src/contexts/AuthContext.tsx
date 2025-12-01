import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { authService, AuthUser, msalInstance } from '../services/authService';
import { config } from '../config';
import axios from 'axios';
import { Department } from '../types/risk';

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  roleOverride: 'ADMIN' | 'EDITOR' | 'STAFF' | 'CONTRIBUTOR' | null;
  setRoleOverride: (role: 'ADMIN' | 'EDITOR' | 'STAFF' | 'CONTRIBUTOR' | null) => void;
  getEffectiveRole: () => 'ADMIN' | 'EDITOR' | 'STAFF' | 'CONTRIBUTOR' | null;
  departmentOverride: Department | null;
  setDepartmentOverride: (department: Department | null) => void;
  getUserDepartment: () => Department | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [roleOverride, setRoleOverrideState] = useState<'ADMIN' | 'EDITOR' | 'STAFF' | 'CONTRIBUTOR' | null>(() => {
    // Load from localStorage on init
    const stored = localStorage.getItem('roleOverride');
    if (stored && ['ADMIN', 'EDITOR', 'STAFF', 'CONTRIBUTOR'].includes(stored)) {
      return stored as 'ADMIN' | 'EDITOR' | 'STAFF' | 'CONTRIBUTOR';
    }
    return null;
  });
  const [departmentOverride, setDepartmentOverrideState] = useState<Department | null>(() => {
    // Load from localStorage on init
    const stored = localStorage.getItem('departmentOverride');
    if (stored && ['BUSINESS_STRATEGY', 'FINANCE', 'HR', 'OPERATIONS', 'PRODUCT', 'MARKETING'].includes(stored)) {
      return stored as Department;
    }
    return null;
  });

  useEffect(() => {
    const init = async () => {
      await authService.initialize();
      
      // Handle redirect response (if user just came back from login)
      try {
        const response = await msalInstance.handleRedirectPromise();
        if (response) {
          console.log('Redirect login successful:', response);
          await syncUser();
        } else if (authService.isAuthenticated()) {
          // Only try to sync if we can get a valid token
          // This prevents 403 errors on page load when token is expired
          const token = await authService.getAccessToken();
          if (token) {
            await syncUser();
          } else {
            // Token acquisition failed, clear the cached account
            console.log('No valid token available, user needs to log in again');
            setUser(null);
          }
        }
      } catch (error) {
        console.error('Error handling redirect:', error);
        setUser(null);
      }
      
      setLoading(false);
    };

    init();
  }, []);

  const syncUser = async () => {
    try {
      const token = await authService.getAccessToken();
      if (!token) {
        console.log('No access token available for sync');
        setUser(null);
        return;
      }

      // Decode token to see what we're sending (for debugging)
      try {
        const tokenParts = token.split('.');
        if (tokenParts.length === 3) {
          const payload = JSON.parse(atob(tokenParts[1]));
          console.log('Token payload (for debugging):', {
            aud: payload.aud,
            iss: payload.iss,
            exp: payload.exp,
            iat: payload.iat,
            sub: payload.sub,
            email: payload.email || payload.preferred_username,
          });
        }
      } catch (e) {
        // Ignore decode errors
      }

      // Sync user with backend
      const response = await axios.post(
        `${config.apiUrl}/api/auth/sync`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setUser(response.data);
    } catch (error: any) {
      // Log detailed error information
      if (error.response?.status === 403 || error.response?.status === 401) {
        console.error('Authentication failed:', {
          status: error.response.status,
          error: error.response.data,
          message: error.response.data?.error || error.response.data?.details,
        });
        setUser(null);
      } else {
        console.error('Error syncing user:', error);
        setUser(null);
      }
    }
  };

  const login = async () => {
    await authService.login();
    await syncUser();
  };

  const logout = async () => {
    await authService.logout();
    setUser(null);
    // Clear role and department overrides on logout
    setRoleOverrideState(null);
    setDepartmentOverrideState(null);
    localStorage.removeItem('roleOverride');
    localStorage.removeItem('departmentOverride');
  };

  const setRoleOverride = (role: 'ADMIN' | 'EDITOR' | 'STAFF' | 'CONTRIBUTOR' | null) => {
    if (role) {
      localStorage.setItem('roleOverride', role);
    } else {
      localStorage.removeItem('roleOverride');
    }
    setRoleOverrideState(role);
    // Clear department override if switching away from CONTRIBUTOR
    if (role !== 'CONTRIBUTOR') {
      setDepartmentOverrideState(null);
      localStorage.removeItem('departmentOverride');
    }
  };

  const setDepartmentOverride = (department: Department | null) => {
    if (department) {
      localStorage.setItem('departmentOverride', department);
    } else {
      localStorage.removeItem('departmentOverride');
    }
    setDepartmentOverrideState(department);
  };

  const getEffectiveRole = (): 'ADMIN' | 'EDITOR' | 'STAFF' | 'CONTRIBUTOR' | null => {
    if (roleOverride) {
      return roleOverride;
    }
    return user?.role as 'ADMIN' | 'EDITOR' | 'STAFF' | 'CONTRIBUTOR' | null;
  };

  const getUserDepartment = (): Department | null => {
    // If testing as CONTRIBUTOR, return the override department
    const effectiveRole = getEffectiveRole();
    if (effectiveRole === 'CONTRIBUTOR' && departmentOverride) {
      return departmentOverride;
    }
    // Otherwise return the user's actual department
    return (user as any)?.department || null;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        isAuthenticated: !!user,
        roleOverride,
        setRoleOverride,
        getEffectiveRole,
        departmentOverride,
        setDepartmentOverride,
        getUserDepartment,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

