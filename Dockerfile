FROM node:24-alpine
WORKDIR /app
COPY . .
RUN npm ci --include=dev && npm test && npm prune --omit=dev
ENV NODE_ENV=production PORT=3000 DATA_DIR=/data
EXPOSE 3000
CMD ["node", "server.js"]
