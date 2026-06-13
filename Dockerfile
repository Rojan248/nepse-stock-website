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

# Copy only backend inputs needed to generate the Prisma client.
COPY backend/prisma ./backend/prisma
COPY backend/src ./backend/src
COPY backend/ecosystem.config.js ./backend/ecosystem.config.js
RUN cd backend && npx prisma generate

# ===== Stage 2: Runner =====
FROM node:18-alpine AS runner

WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV PORT=5000

# Install PM2 globally
RUN npm install -g pm2

# Copy only runtime backend artifacts. Do not ship tests, local env files,
# SQLite snapshots, logs, backups, or other development-only files.
COPY --from=builder /app/backend/package*.json /app/backend/
COPY --from=builder /app/backend/node_modules /app/backend/node_modules
COPY --from=builder /app/backend/prisma /app/backend/prisma
COPY --from=builder /app/backend/src /app/backend/src
COPY --from=builder /app/backend/ecosystem.config.js /app/backend/ecosystem.config.js

# Copy built frontend assets to the location configured in backend/src/server.js
# backend/src/server.js uses: path.join(__dirname, '../../frontend/dist')
# Since server.js is in /app/backend/src, ../../frontend/dist is /app/frontend/dist
COPY --from=builder /app/frontend/dist /app/frontend/dist

# Prune dev dependencies in backend. Prisma remains a production dependency
# because the container runs migrations during startup.
RUN cd backend && npm prune --omit=dev

# Expose the API port
EXPOSE 5000

# Database persistence directory (Volume mapping in docker-compose)
RUN mkdir -p /app/backend/prisma

# Start the application using PM2 Runtime
# We run prisma generate again to ensure the client matches the environment
# and prisma migrate deploy to ensure DB schema is up to date.
WORKDIR /app/backend
CMD ./node_modules/.bin/prisma generate && ./node_modules/.bin/prisma migrate deploy && pm2-runtime start ecosystem.config.js --env production
