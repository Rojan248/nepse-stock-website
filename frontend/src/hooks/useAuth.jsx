import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

const USER_KEY = 'nepse-user';
const ACCESS_TOKEN_TTL_MS = 14 * 60 * 1000; // 14 min (refresh before 15m expiry)

export function AuthProvider({ children }) {
    // Access token stored in ref (in-memory only — never localStorage)
    const accessTokenRef = useRef(null);
    const refreshTimerRef = useRef(null);
    const isRefreshingRef = useRef(false);
    const refreshPromiseRef = useRef(null);

    const [user, setUser] = useState(() => {
        try {
            const stored = localStorage.getItem(USER_KEY);
            return stored ? JSON.parse(stored) : null;
        } catch { return null; }
    });
    const [loading, setLoading] = useState(true);

    // Persist user hint to localStorage (for initial hydration on reload)
    useEffect(() => {
        if (user) {
            localStorage.setItem(USER_KEY, JSON.stringify(user));
        } else {
            localStorage.removeItem(USER_KEY);
        }
    }, [user]);

    // Schedule proactive silent refresh before token expires
    const scheduleRefresh = useCallback(() => {
        if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = setTimeout(async () => {
            try {
                await silentRefresh();
            } catch {
                // Refresh failed — will be caught on next API call
            }
        }, ACCESS_TOKEN_TTL_MS);
    }, []);

    // Silent refresh: POST /auth/refresh with no body (cookie sent automatically)
    const silentRefresh = useCallback(async () => {
        // Deduplicate concurrent refresh calls
        if (isRefreshingRef.current && refreshPromiseRef.current) {
            return refreshPromiseRef.current;
        }
        isRefreshingRef.current = true;

        const promise = (async () => {
            try {
                const resp = await api.post('/auth/refresh');
                const data = resp.data || resp;
                accessTokenRef.current = data.accessToken;
                if (data.user) setUser(data.user);
                scheduleRefresh();
                return data;
            } catch (err) {
                accessTokenRef.current = null;
                setUser(null);
                localStorage.removeItem(USER_KEY);
                throw err;
            } finally {
                isRefreshingRef.current = false;
                refreshPromiseRef.current = null;
            }
        })();

        refreshPromiseRef.current = promise;
        return promise;
    }, [scheduleRefresh]);

    // Setup axios interceptors
    useEffect(() => {
        // Request interceptor: attach in-memory access token
        const reqInterceptor = api.interceptors.request.use((config) => {
            if (accessTokenRef.current) {
                config.headers.Authorization = `Bearer ${accessTokenRef.current}`;
            }
            return config;
        });

        // Response interceptor: auto-refresh on 401
        const resInterceptor = api.interceptors.response.use(
            (response) => response,
            async (error) => {
                const originalRequest = error.config;
                // Don't retry the refresh endpoint itself or already-retried requests
                if (
                    error.response?.status === 401 &&
                    !originalRequest.skipAuthRefresh &&
                    !originalRequest._retry &&
                    !originalRequest.url?.includes('/auth/refresh')
                ) {
                    originalRequest._retry = true;
                    try {
                        const data = await silentRefresh();
                        originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
                        return api(originalRequest);
                    } catch {
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
    }, [silentRefresh]);

    // On mount: silent refresh to verify session (replaces old /auth/me call)
    useEffect(() => {
        // Clean up legacy localStorage tokens from previous implementation
        localStorage.removeItem('nepse-access-token');
        localStorage.removeItem('nepse-refresh-token');

        const storedUser = localStorage.getItem(USER_KEY);
        if (!storedUser) {
            setLoading(false);
            return;
        }

        // Attempt silent refresh — if cookie exists, we get a fresh token + user
        silentRefresh()
            .catch(() => {
                // No valid session — already cleaned up in silentRefresh
            })
            .finally(() => setLoading(false));
    }, []);

    const login = useCallback(async (email, password) => {
        const resp = await api.post('/auth/login', { email, password });
        const data = resp.data || resp;
        accessTokenRef.current = data.accessToken;
        setUser(data.user);
        scheduleRefresh();
        return data.user;
    }, [scheduleRefresh]);

    const register = useCallback(async (email, password, displayName) => {
        const resp = await api.post('/auth/register', { email, password, displayName });
        const data = resp.data || resp;
        accessTokenRef.current = data.accessToken;
        setUser(data.user);
        scheduleRefresh();
        return data.user;
    }, [scheduleRefresh]);

    const logout = useCallback(() => {
        // Cookie sent automatically — backend clears it
        api.post('/auth/logout').catch(() => {});
        accessTokenRef.current = null;
        if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
        localStorage.removeItem(USER_KEY);
        setUser(null);
    }, []);

    // Cleanup timer on unmount
    useEffect(() => {
        return () => {
            if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
        };
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
