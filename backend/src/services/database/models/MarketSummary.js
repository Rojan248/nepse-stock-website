/**
 * DEPRECATED: MongoDB MarketSummary Model
 * 
 * This file is no longer used. The application now uses Firebase Firestore.
 * See: src/services/database/firebase.js
 * See: src/services/database/marketOperations.js
 * 
 * Keeping for reference only.
 */

// MarketSummary schema reference (for Firestore document structure):
// Collection: marketSummary, Document: "current"
// {
//   indexValue: Number,
//   indexChange: Number,
//   indexChangePercent: Number,
//   totalTransactions: Number,
//   totalTurnover: Number,
//   totalVolume: Number,
//   activeCompanies: Number,
//   advancedCompanies: Number,
//   declinedCompanies: Number,
//   unchangedCompanies: Number,
//   timestamp: Date,
//   updatedAt: Date
// }

module.exports = {};
