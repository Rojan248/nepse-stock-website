/**
 * DEPRECATED: MongoDB IPO Model
 * 
 * This file is no longer used. The application now uses Firebase Firestore.
 * See: src/services/database/firebase.js
 * See: src/services/database/ipoOperations.js
 * 
 * Keeping for reference only.
 */

// IPO schema reference (for Firestore document structure):
// {
//   companyName: String (used for document ID),
//   sector: String,
//   shareManager: String,
//   issueManager: String,
//   priceRange: { min, max },
//   totalShares: Number,
//   status: 'upcoming' | 'open' | 'closed' | 'completed',
//   dates: { announcement, applicationOpen, applicationClose, resultDate, allotmentDate },
//   subscriptionRatio: Number,
//   minimumShares: Number,
//   maximumShares: Number,
//   issuedShares: Number,
//   timestamp: Date,
//   updatedAt: Date
// }

module.exports = {};
