/**
 * Firestore Client Service
 * Optional helpers for direct Firestore reads from frontend
 * 
 * NOTE: These are non-authenticated, read-only operations.
 * The primary data source remains the backend REST API (services/api.js).
 * Use these only for experiments or real-time subscriptions.
 */

import { collection, getDocs, doc, getDoc, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { getDb, isConfigured } from '../firebase/clientApp';

/**
 * Check if Firestore client is available
 */
export const isFirestoreAvailable = () => {
    return isConfigured() && getDb() !== null;
};

/**
 * Get all stocks snapshot (one-time read)
 * Returns array of stock documents
 */
export const getPublicStocksSnapshot = async () => {
    if (!isFirestoreAvailable()) {
        console.warn('Firestore not configured, falling back to API');
        return null;
    }

    try {
        const db = getDb();
        const stocksRef = collection(db, 'stocks');
        const q = query(stocksRef, orderBy('symbol'), limit(500));
        const snapshot = await getDocs(q);

        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    } catch (error) {
        console.error('Firestore read failed:', error);
        return null;
    }
};

/**
 * Get single stock by symbol
 */
export const getPublicStockBySymbol = async (symbol) => {
    if (!isFirestoreAvailable()) return null;

    try {
        const db = getDb();
        const stockRef = doc(db, 'stocks', symbol.toUpperCase());
        const snapshot = await getDoc(stockRef);

        if (!snapshot.exists()) return null;

        return { id: snapshot.id, ...snapshot.data() };
    } catch (error) {
        console.error('Firestore read failed:', error);
        return null;
    }
};

/**
 * Get market summary
 */
export const getPublicMarketSummary = async () => {
    if (!isFirestoreAvailable()) return null;

    try {
        const db = getDb();
        const summaryRef = doc(db, 'marketSummary', 'current');
        const snapshot = await getDoc(summaryRef);

        if (!snapshot.exists()) return null;

        return { id: snapshot.id, ...snapshot.data() };
    } catch (error) {
        console.error('Firestore read failed:', error);
        return null;
    }
};

/**
 * Subscribe to real-time stock updates (returns unsubscribe function)
 * Example usage:
 *   const unsubscribe = subscribeToStocks((stocks) => setStocks(stocks));
 *   // Later: unsubscribe();
 */
export const subscribeToStocks = (callback) => {
    if (!isFirestoreAvailable()) {
        console.warn('Firestore not configured');
        return () => { };
    }

    try {
        const db = getDb();
        const stocksRef = collection(db, 'stocks');
        const q = query(stocksRef, orderBy('symbol'), limit(500));

        return onSnapshot(q, (snapshot) => {
            const stocks = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            callback(stocks);
        }, (error) => {
            console.error('Firestore subscription error:', error);
        });
    } catch (error) {
        console.error('Failed to subscribe:', error);
        return () => { };
    }
};

/**
 * Subscribe to real-time market summary updates
 */
export const subscribeToMarketSummary = (callback) => {
    if (!isFirestoreAvailable()) return () => { };

    try {
        const db = getDb();
        const summaryRef = doc(db, 'marketSummary', 'current');

        return onSnapshot(summaryRef, (snapshot) => {
            if (snapshot.exists()) {
                callback({ id: snapshot.id, ...snapshot.data() });
            }
        }, (error) => {
            console.error('Firestore subscription error:', error);
        });
    } catch (error) {
        console.error('Failed to subscribe:', error);
        return () => { };
    }
};
