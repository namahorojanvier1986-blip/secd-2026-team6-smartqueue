# One container: builds the React app, then the Express API serves both /api and the UI.
FROM node:20-alpine AS web
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

FROM node:20-alpine
ENV NODE_ENV=production
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm install --omit=dev
COPY backend/ ./
COPY --from=web /app/frontend/dist /app/frontend/dist
EXPOSE 4000
CMD ["node", "src/server.js"]
