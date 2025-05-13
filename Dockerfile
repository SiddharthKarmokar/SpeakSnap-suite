# Stage 1: Build frontend
FROM node:18 AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Prepare backend with built frontend
FROM node:18 AS backend-build
WORKDIR /app
COPY backend/ ./backend
COPY --from=frontend-build /app/frontend/dist ./backend/public
WORKDIR /app/backend
RUN npm install

# Stage 3: Final production image
FROM node:18-slim
WORKDIR /app
COPY --from=backend-build /app/backend ./

# Install dotenv CLI for runtime env var support
RUN npm install -g dotenv-cli

# Set runtime environment
ENV NODE_ENV=production
EXPOSE 8080

CMD ["dotenv", "--", "node", "server.js"]
