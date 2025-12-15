/**
 * Firebase Client-Side Configuration
 * For optional direct Firestore reads from the frontend
 * 
 * NOTE: Primary data source remains the backend REST API (services/api.js).
 * This is for experimental/optional direct reads only.
 */

import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// Firebase configuration from environment variables
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'nepse-stock-website',
    appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Initialize Firebase (only if config is available)
let app = null;
let db = null;

const isConfigured = () => {
    return firebaseConfig.apiKey && firebaseConfig.projectId;
};

const initializeFirebase = () => {
    if (!app && isConfigured()) {
        try {
            app = initializeApp(firebaseConfig);
            db = getFirestore(app);
            console.log('Firebase client initialized');
        } catch (error) {
            console.warn('Firebase client initialization failed:', error.message);
        }
    }
    return { app, db };
};

// Lazy initialization - only init when actually used
const getApp = () => {
    if (!app) initializeFirebase();
    return app;
};

const getDb = () => {
    if (!db) initializeFirebase();
    return db;
};

export { getApp, getDb, isConfigured };
export default { getApp, getDb, isConfigured };
