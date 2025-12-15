# Setup Guide

Complete guide to set up the NEPSE Stock Website for development and production.

## Prerequisites

- **Node.js** 18.x or higher
- **MongoDB** 6.x or higher (local or Atlas)
- **Git** for version control
- **npm** or **yarn** package manager

---

## Development Setup

### Step 1: Clone Repository

```bash
git clone https://github.com/yourusername/nepse-stock-website.git
cd nepse-stock-website
```

### Step 2: Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Edit .env with your configuration
# Required: MONGODB_URI
```

**Minimum .env configuration:**
```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/nepse
```

**Start backend:**
```bash
npm run dev
```

Backend runs on **http://localhost:5000**

### Step 3: Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

Frontend runs on **http://localhost:3000**

---

## Firebase Setup

This project uses **Firebase Firestore** as the database.

### Step 1: Install Firebase CLI

```bash
npm install -g firebase-tools
```

### Step 2: Login to Firebase

```bash
firebase login
```

This will open your browser for Google account authentication. Follow the prompts to log in.

### Step 3: Initialize Firestore (if not done)

```bash
firebase init firestore
```

- Select "Use an existing project" or create a new one
- Accept default file names: `firestore.rules`, `firestore.indexes.json`

### Current Project
- **Project ID:** `nepse-stock-website`
- **Database Location:** `asia-northeast1`
- **Config files:** `firebase.json`, `.firebaserc`

### Service Account (for backend)

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Project Settings → Service Accounts
3. Generate new private key
4. Save as `backend/serviceAccountKey.json`
5. Add to `.gitignore`

---

## MongoDB Setup (Deprecated)

### Option A: Local MongoDB

1. Install MongoDB Community Edition
2. Start MongoDB service
3. Use connection string: `mongodb://localhost:27017/nepse`

### Option B: MongoDB Atlas (Cloud)

1. Create account at [mongodb.com/atlas](https://mongodb.com/atlas)
2. Create a free cluster
3. Create database user
4. Get connection string
5. Update `.env`: `MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/nepse`

---

## Production Deployment

### Backend Deployment (Render.com)

1. Push code to GitHub
2. Create Render account
3. New → Web Service → Connect GitHub
4. Configure:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
5. Add environment variables
6. Deploy

### Frontend Deployment (Vercel)

1. Push code to GitHub
2. Import to Vercel
3. Set environment variable:
   - `VITE_API_URL=https://your-backend-url.com/api`
4. Deploy

---

## Testing

```bash
# Backend tests
cd backend && npm test

# Frontend tests
cd frontend && npm test
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| MongoDB connection fails | Check MONGODB_URI in .env |
| CORS errors | Verify CORS_ORIGIN in backend .env |
| No data showing | Ensure backend is running |
| Build fails | Delete node_modules and reinstall |

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for more solutions.
