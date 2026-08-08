import { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { jwtDecode } from 'jwt-decode';
import api from '../api/client';
import useChatStore from '../store/useChatStore';
import useUserStore from '../store/useUserStore';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUserState] = useState(null);
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('access_token'));

  // ---- Decode token to get userId ----
  const decodeAndSetUserId = useCallback((token) => {
    try {
      const decoded = jwtDecode(token);
      const id = decoded.user_id || decoded.id || null;
      if (id) {
        setUserId(id);
        console.log('User ID from token:', id);
      } else {
        console.warn('Token does not contain user ID. Claims:', decoded);
      }
    } catch (error) {
      console.error('Failed to decode token', error);
    }
  }, []);

  // ---- LOGOUT ----
  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('access_token');
      setToken(null);
      setUserState(null);
      setUserId(null);
      delete api.defaults.headers.common['Authorization'];
      // Reset stores
      useChatStore.getState().reset();
      useUserStore.getState().reset();
      setLoading(false);
    }
  }, []);

  // ---- FETCH USER ----
  const fetchUser = useCallback(async () => {
    try {
      const response = await api.get('/profile/me');
      setUserState(response.data);
    } catch (error) {
      console.error('Failed to fetch user:', error);
      await logout();
    } finally {
      setLoading(false);
    }
  }, [logout]);

  // ---- EFFECT: initialize token and fetch user ----
  useEffect(() => {
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      decodeAndSetUserId(token);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchUser();
    } else {
      setLoading(false);
    }
  }, [token, fetchUser, decodeAndSetUserId]);

  // ---- LOGIN ----
  const login = async (username, password) => {
    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);

    try {
      const response = await api.post('/auth/login', formData, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      const { access_token } = response.data;
      localStorage.setItem('access_token', access_token);
      setToken(access_token);
      decodeAndSetUserId(access_token);
      api.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
      await fetchUser();
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.detail || 'Login failed';
      return { success: false, error: message };
    }
  };

  // ---- REGISTER ----
  const register = async (userData) => {
    try {
      const response = await api.post('/auth/register', userData);
      const { access_token } = response.data;
      localStorage.setItem('access_token', access_token);
      setToken(access_token);
      decodeAndSetUserId(access_token);
      api.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
      await fetchUser();
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.detail || 'Registration failed';
      return { success: false, error: message };
    }
  };

  const setUser = (newUser) => setUserState(newUser);

  const value = {
    user,
    userId,
    setUser,
    loading,
    login,
    register,
    logout,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);