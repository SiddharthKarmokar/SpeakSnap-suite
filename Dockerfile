# Stage 1: Build React frontend
FROM node:18 AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ .
RUN npm run build

# Stage 2: Prepare Node.js backend
FROM node:18 AS backend
WORKDIR /app
COPY backend/ ./backend
COPY --from=frontend-build /app/frontend/build ./backend/public
WORKDIR /app/backend
RUN npm install

# Stage 3: Final production image
FROM node:18-slim
WORKDIR /app
COPY --from=backend /app/backend ./
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "server.js"]
