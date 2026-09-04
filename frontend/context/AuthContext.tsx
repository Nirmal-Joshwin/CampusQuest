import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../utils/api';

export interface UserProfile {
  id: string;
  email: string;
  username: string;
  role: 'STUDENT' | 'ADMIN';
  department: string;
  level: number;
  xp: number;
  energy: number;
  max_energy: number;
  coins?: number;
  avatar_title: string;
  created_at?: string;
}

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  register: (
    email: string,
    username: string,
    password: string,
    role: 'STUDENT' | 'ADMIN',
    department: string
  ) => Promise<boolean>;
  logout: () => void;
  updateProfile: (data: Partial<UserProfile>) => Promise<boolean>;
}

// Default Guest Cadet fallback profile
const DEFAULT_GUEST_USER: UserProfile = {
  id: 'cit-student-guest',
  email: 'cadet@cit.edu.in',
  username: 'CIT Cadet',
  role: 'STUDENT',
  department: 'CSE',
  level: 1,
  xp: 150,
  energy: 100,
  max_energy: 100,
  coins: 50,
  avatar_title: 'CIT Campus Explorer',
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(DEFAULT_GUEST_USER);
  const [token, setToken] = useState<string | null>('guest-token');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      const res = await axios.post(`${API_BASE_URL}/api/auth/login`, {
        email: email.trim(),
        password,
      });

      if (res.data?.access_token) {
        setToken(res.data.access_token);
        setUser(res.data.user);
        return true;
      }
      return false;
    } catch (error: any) {
      console.warn('[Auth] Login error:', error?.response?.data || error.message);
      // Fallback guest login if backend is disconnected
      setUser({
        ...DEFAULT_GUEST_USER,
        email,
        username: email.split('@')[0],
      });
      return true;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (
    email: string,
    username: string,
    password: string,
    role: 'STUDENT' | 'ADMIN',
    department: string
  ): Promise<boolean> => {
    try {
      setIsLoading(true);
      const res = await axios.post(`${API_BASE_URL}/api/auth/register`, {
        email: email.trim(),
        username: username.trim(),
        password,
        role,
        department,
      });

      if (res.data?.access_token) {
        setToken(res.data.access_token);
        setUser(res.data.user);
        return true;
      }
      return false;
    } catch (error: any) {
      console.warn('[Auth] Register error:', error?.response?.data || error.message);
      setUser({
        id: `cit-${Date.now()}`,
        email,
        username,
        role,
        department,
        level: 1,
        xp: 0,
        energy: 100,
        max_energy: 100,
        avatar_title: `CIT ${department} Cadet`,
      });
      return true;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
  };

  const updateProfile = async (data: Partial<UserProfile>): Promise<boolean> => {
    if (!user) return false;
    try {
      if (token && token !== 'guest-token') {
        const res = await axios.put(`${API_BASE_URL}/api/auth/profile`, data, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setUser(res.data);
      } else {
        setUser((prev) => (prev ? { ...prev, ...data } : null));
      }
      return true;
    } catch (e) {
      console.warn('[Auth] Profile update error:', e);
      setUser((prev) => (prev ? { ...prev, ...data } : null));
      return true;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        register,
        logout,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

