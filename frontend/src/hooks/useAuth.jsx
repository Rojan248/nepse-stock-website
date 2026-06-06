import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

const USER_KEY = 'nepse-user';
const ACCESS_TOKEN_TTL_MS = 14 * 60 * 1000; // 14 min (refresh before 15m expiry)

const readStoredUser = () => {
    try {
        const stored = localStorage.getItem(USER_KEY);
        return stored ? JSON.parse(stored) : null;
    } catch {
        return null;
    }
};

const clearStoredUser = () => localStorage.removeItem(USER_KEY);

const persistStoredUser = (user) => {
    if (user) {
        // Minimize data stored in localStorage (prevent PII / privilege leakage)
        const minimalUser = { id: user.id, displayName: user.displayName };
        localStorage.setItem(USER_KEY, JSON.stringify(minimalUser));
    }
    else clearStoredUser();
};

const unwrapApiData = (response) => response.data || response;

const cleanupLegacyTokens = () => {
    localStorage.removeItem('nepse-access-token');
    localStorage.removeItem('nepse-refresh-token');
};

function useStoredUser() {
    const [user, setUser] = useState(readStoredUser);
    useEffect(() => persistStoredUser(user), [user]);
    return [user, setUser];
}

function useTokenRefresh(accessTokenRef, setUser) {
    const refreshTimerRef = useRef(null);
    const isRefreshingRef = useRef(false);
    const refreshPromiseRef = useRef(null);
    const silentRefreshRef = useRef(null);

    const clearRefreshTimer = useCallback(() => {
        if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    }, []);

    const scheduleRefresh = useCallback(() => {
        clearRefreshTimer();
        refreshTimerRef.current = setTimeout(async () => {
            try {
                await silentRefreshRef.current?.();
            } catch {
                // Refresh failed; the next API call will handle auth state.
            }
        }, ACCESS_TOKEN_TTL_MS);
    }, [clearRefreshTimer]);

    const silentRefresh = useCallback(async () => {
        if (isRefreshingRef.current && refreshPromiseRef.current) {
            return refreshPromiseRef.current;
        }
        isRefreshingRef.current = true;

        const promise = (async () => {
            try {
                const resp = await api.post('/auth/refresh');
                const data = unwrapApiData(resp);
                accessTokenRef.current = data.accessToken;
                if (data.user) setUser(data.user);
                scheduleRefresh();
                return data;
            } catch (err) {
                accessTokenRef.current = null;
                setUser(null);
                clearStoredUser();
                throw err;
            } finally {
                isRefreshingRef.current = false;
                refreshPromiseRef.current = null;
            }
        })();

        refreshPromiseRef.current = promise;
        return promise;
    }, [accessTokenRef, scheduleRefresh, setUser]);

    useEffect(() => {
        silentRefreshRef.current = silentRefresh;
    }, [silentRefresh]);

    useEffect(() => clearRefreshTimer, [clearRefreshTimer]);

    return { silentRefresh, scheduleRefresh, clearRefreshTimer };
}

const shouldRetryWithRefresh = (error) => {
    const originalRequest = error.config;
    return Boolean(
        error.response?.status === 401
        && !originalRequest.skipAuthRefresh
        && !originalRequest._retry
        && !originalRequest.url?.includes('/auth/refresh')
    );
};

function useAuthInterceptors(accessTokenRef, silentRefresh) {
    useEffect(() => {
        const reqInterceptor = api.interceptors.request.use((config) => {
            if (accessTokenRef.current) {
                config.headers.Authorization = `Bearer ${accessTokenRef.current}`;
            }
            return config;
        });

        const resInterceptor = api.interceptors.response.use(
            (response) => response,
            async (error) => {
                const originalRequest = error.config;
                if (shouldRetryWithRefresh(error)) {
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
    }, [accessTokenRef, silentRefresh]);
}

function useSessionBootstrap(silentRefresh, setLoading) {
    useEffect(() => {
        cleanupLegacyTokens();

        if (!localStorage.getItem(USER_KEY)) {
            setLoading(false);
            return;
        }

        silentRefresh()
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [silentRefresh, setLoading]);
}

function useAuthActions(accessTokenRef, setUser, scheduleRefresh, clearRefreshTimer) {
    const login = useCallback(async (email, password) => {
        const data = unwrapApiData(await api.post('/auth/login', { email, password }));
        accessTokenRef.current = data.accessToken;
        setUser(data.user);
        scheduleRefresh();
        return data.user;
    }, [accessTokenRef, scheduleRefresh, setUser]);

    const register = useCallback(async (email, password, displayName) => {
        const data = unwrapApiData(await api.post('/auth/register', { email, password, displayName }));
        accessTokenRef.current = data.accessToken;
        setUser(data.user);
        scheduleRefresh();
        return data.user;
    }, [accessTokenRef, scheduleRefresh, setUser]);

    const logout = useCallback(() => {
        api.post('/auth/logout').catch(() => {});
        accessTokenRef.current = null;
        clearRefreshTimer();
        clearStoredUser();
        setUser(null);
    }, [accessTokenRef, clearRefreshTimer, setUser]);

    return { login, register, logout };
}

export function AuthProvider({ children }) {
    const accessTokenRef = useRef(null);
    const [user, setUser] = useStoredUser();
    const [loading, setLoading] = useState(true);
    const { silentRefresh, scheduleRefresh, clearRefreshTimer } = useTokenRefresh(accessTokenRef, setUser);
    const { login, register, logout } = useAuthActions(accessTokenRef, setUser, scheduleRefresh, clearRefreshTimer);

    useAuthInterceptors(accessTokenRef, silentRefresh);
    useSessionBootstrap(silentRefresh, setLoading);

    const value = { user, loading, login, register, logout, isAuthenticated: !!user };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
};

export default AuthContext;
