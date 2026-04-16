# ===== Stage 1: Builder =====
FROM node:18-alpine AS builder

WORKDIR /app

# Install root dependencies (if any)
COPY package*.json ./
RUN npm install --include=dev

# Copy backend and install dependencies
COPY backend/package*.json ./backend/
RUN cd backend && npm install

# Copy frontend and build
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm install
COPY frontend/ ./frontend/
RUN cd frontend && npm run build

# Copy backend source and generate Prisma client
COPY backend/ ./backend/
RUN cd backend && npx prisma generate

# ===== Stage 2: Runner =====
FROM node:18-alpine AS runner

WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV PORT=5000

# Install PM2 globally
RUN npm install -g pm2

# Copy backend source
COPY --from=builder /app/backend /app/backend

# Copy built frontend assets to the location configured in backend/src/server.js
# backend/src/server.js uses: path.join(__dirname, '../../frontend/dist')
# Since server.js is in /app/backend/src, ../../frontend/dist is /app/frontend/dist
COPY --from=builder /app/frontend/dist /app/frontend/dist

# Prune dev dependencies in backend
RUN cd backend && npm prune --production

# Expose the API port
EXPOSE 5000

# Database persistence directory (Volume mapping in docker-compose)
RUN mkdir -p /app/backend/prisma

# Start the application using PM2 Runtime
# We run prisma generate again to ensure the client matches the environment
# And we use prisma migrate deploy to ensure DB schema is up to date
WORKDIR /app/backend
CMD npx prisma generate && npx prisma migrate deploy && pm2-runtime start ecosystem.config.js --env production
