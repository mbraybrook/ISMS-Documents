import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { trustApi } from '../services/trustApi';
import type { ExternalUser } from '../types/trust';

interface TrustAuthContextType {
  user: ExternalUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  hasAcceptedTerms: boolean;
  refreshUser: () => Promise<void>;
}

const TrustAuthContext = createContext<TrustAuthContextType | undefined>(undefined);

export function TrustAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ExternalUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    try {
      if (trustApi.isTokenExpired()) {
        setUser(null);
        trustApi.logout();
        return;
      }

      const userData = await trustApi.getMe();
      setUser(userData);
    } catch (error) {
      console.error('[TrustAuth] Error refreshing user:', error);
      setUser(null);
      trustApi.logout();
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        // Check if we have a valid token
        if (trustApi.isTokenExpired()) {
          trustApi.logout();
          setUser(null);
          setLoading(false);
          return;
        }

        // Try to get user info
        await refreshUser();
      } catch (error) {
        console.error('[TrustAuth] Initialization error:', error);
        setUser(null);
        trustApi.logout();
      } finally {
        setLoading(false);
      }
    };

    init();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const response = await trustApi.login(email, password);
      setUser(response.user);
    } catch (error: any) {
      console.error('[TrustAuth] Login error:', error);
      throw error;
    }
  };

  const logout = () => {
    trustApi.logout();
    setUser(null);
  };

  const isAuthenticated = !!user && user.isApproved && !trustApi.isTokenExpired();
  const hasAcceptedTerms = !!user?.termsAcceptedAt;

  return (
    <TrustAuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        isAuthenticated,
        hasAcceptedTerms,
        refreshUser,
      }}
    >
      {children}
    </TrustAuthContext.Provider>
  );
}

export function useTrustAuth() {
  const context = useContext(TrustAuthContext);
  if (context === undefined) {
    throw new Error('useTrustAuth must be used within a TrustAuthProvider');
  }
  return context;
}

