FROM node:18-alpine

WORKDIR /app

# Copy admin dashboard files
COPY test-guac/admin-dashboard/package.json .
COPY test-guac/admin-dashboard/server.js .
COPY test-guac/admin-dashboard/public ./public

# Install dependencies
RUN npm install

EXPOSE 3000

CMD ["node", "server.js"]
