/**
 * Firebase Configuration (Client SDK Compat)
 * Initializes Firestore using Client SDK to bypass Admin SDK clock requirements
 */

// Use compat libraries for API compatibility with existing code
const firebase = require('firebase/compat/app');
require('firebase/compat/firestore');
const logger = require('../utils/logger');

// Public configuration for Client SDK (run in Node)
// Works because "firebase" package supports Node.js environment
const firebaseConfig = {
    apiKey: "AIzaSyD2ZKminh6ib5Rh8XF5B-PBzKZ8Dy22Hqc",
    authDomain: "nepse-stock-website.firebaseapp.com",
    projectId: "nepse-stock-website",
    storageBucket: "nepse-stock-website.firebasestorage.app",
    messagingSenderId: "952598694406",
    appId: "1:952598694406:web:c78add95c57b844f1dd187"
};

let db = null;
let isInitialized = false;

const initializeFirebase = () => {
    if (isInitialized) return db;

    try {
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
            logger.info('Firebase initialized (Client SDK Compat Mode)');
        } else {
            firebase.app(); // already initialized
        }

        db = firebase.firestore();
        isInitialized = true;

        logger.info('Firestore instance created');
        return db;

    } catch (error) {
        logger.error(`Firebase initialization failed: ${error.message}`);
        throw error;
    }
};

const getDb = () => {
    if (!isInitialized) {
        return initializeFirebase();
    }
    return db;
};

const isConnected = () => {
    return isInitialized && db !== null;
};

module.exports = {
    initializeFirebase,
    getDb,
    isConnected,
    // admin: firebase // optional alias if needed, but methods differ slightly on 'auth'
};
