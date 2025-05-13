# Stage 1: Build frontend
FROM node:18 AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./

# Stage 2: Final production image (no separate backend build)
FROM node:18-slim
WORKDIR /app

# Copy backend files
COPY backend/ ./backend
# Copy the built frontend (dist) into the backend's public folder
COPY --from=frontend-build /app/frontend/dist ./backend/public

# Install dependencies for backend
WORKDIR /app/backend
RUN npm install

# Install dotenv CLI for runtime env var support
RUN npm install -g dotenv-cli

ENV NODE_ENV=production
EXPOSE 8080

CMD ["dotenv", "--", "node", "server.js"]
