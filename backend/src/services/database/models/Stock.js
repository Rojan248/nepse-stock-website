/**
 * DEPRECATED: MongoDB Stock Model
 * 
 * This file is no longer used. The application now uses Firebase Firestore.
 * See: src/services/database/firebase.js
 * See: src/services/database/stockOperations.js
 * 
 * Keeping for reference only.
 */

// Stock schema reference (for Firestore document structure):
// {
//   symbol: String (document ID),
//   companyName: String,
//   sector: String,
//   prices: { open, high, low, close, ltp },
//   volume: Number,
//   turnover: Number,
//   noOfTransactions: Number,
//   change: Number,
//   changePercent: Number,
//   previousClose: Number,
//   marketCap: Number,
//   timestamp: Date,
//   updatedAt: Date
// }

module.exports = {};
