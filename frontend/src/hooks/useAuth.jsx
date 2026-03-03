import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

const TOKEN_KEY = 'nepse-access-token';
const REFRESH_KEY = 'nepse-refresh-token';
const USER_KEY = 'nepse-user';

export function AuthProvider({ children }) {
    const [user, setUser] = useState(() => {
        try {
            const stored = localStorage.getItem(USER_KEY);
            return stored ? JSON.parse(stored) : null;
        } catch { return null; }
    });
    const [loading, setLoading] = useState(true);

    // Persist user to localStorage
    useEffect(() => {
        if (user) {
            localStorage.setItem(USER_KEY, JSON.stringify(user));
        } else {
            localStorage.removeItem(USER_KEY);
        }
    }, [user]);

    // Setup axios interceptors for auth
    useEffect(() => {
        // Request interceptor: attach access token
        const reqInterceptor = api.interceptors.request.use((config) => {
            const token = localStorage.getItem(TOKEN_KEY);
            if (token) {
                config.headers.Authorization = `Bearer ${token}`;
            }
            return config;
        });

        // Response interceptor: auto-refresh on 401
        const resInterceptor = api.interceptors.response.use(
            (response) => response,
            async (error) => {
                const originalRequest = error.config;
                if (error.response?.status === 401 && !originalRequest._retry) {
                    originalRequest._retry = true;
                    try {
                        const refreshToken = localStorage.getItem(REFRESH_KEY);
                        if (!refreshToken) throw new Error('No refresh token');

                        const resp = await api.post('/auth/refresh', { refreshToken });
                        const data = resp.data || resp;
                        localStorage.setItem(TOKEN_KEY, data.accessToken);
                        localStorage.setItem(REFRESH_KEY, data.refreshToken);
                        originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
                        return api(originalRequest);
                    } catch {
                        // Refresh failed — log out
                        logout();
                        return Promise.reject(error);
                    }
                }
                return Promise.reject(error);
            }
        );

        return () => {
            api.interceptors.request.eject(reqInterceptor);
            api.interceptors.response.eject(resInterceptor);
        };
    }, []);

    // Verify token on mount
    useEffect(() => {
        const token = localStorage.getItem(TOKEN_KEY);
        if (!token) { setLoading(false); return; }

        api.get('/auth/me')
            .then((resp) => {
                const data = resp.data || resp;
                setUser(data);
            })
            .catch(() => {
                // Token invalid
                logout();
            })
            .finally(() => setLoading(false));
    }, []);

    const login = useCallback(async (email, password) => {
        const resp = await api.post('/auth/login', { email, password });
        const data = resp.data || resp;
        localStorage.setItem(TOKEN_KEY, data.accessToken);
        localStorage.setItem(REFRESH_KEY, data.refreshToken);
        setUser(data.user);
        return data.user;
    }, []);

    const register = useCallback(async (email, password, displayName) => {
        const resp = await api.post('/auth/register', { email, password, displayName });
        const data = resp.data || resp;
        localStorage.setItem(TOKEN_KEY, data.accessToken);
        localStorage.setItem(REFRESH_KEY, data.refreshToken);
        setUser(data.user);
        return data.user;
    }, []);

    const logout = useCallback(() => {
        const refreshToken = localStorage.getItem(REFRESH_KEY);
        if (refreshToken) {
            api.post('/auth/logout', { refreshToken }).catch(() => {});
        }
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(REFRESH_KEY);
        localStorage.removeItem(USER_KEY);
        setUser(null);
    }, []);

    const value = { user, loading, login, register, logout, isAuthenticated: !!user };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
};

export default AuthContext;
