# Stage 1: Build frontend (optional – only if needed for integration)
FROM node:18 AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Production image for backend
FROM node:18-slim
WORKDIR /app

# Copy backend files
COPY backend/ ./backend
WORKDIR /app/backend
RUN npm install

# Copy built frontend (optional – comment if Vercel handles frontend)
# COPY --from=frontend-build /app/frontend/dist ../frontend/dist

# Install dotenv CLI
RUN npm install -g dotenv-cli

ENV NODE_ENV=production
EXPOSE 8080

CMD ["dotenv", "--", "node", "server.js"]
