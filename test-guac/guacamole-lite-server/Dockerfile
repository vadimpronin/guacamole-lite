FROM node:18-alpine

WORKDIR /app

# Copy the entire project (including the enhanced fork)
COPY package.json .
COPY lib ./lib
COPY index.js .

# Copy the enhanced server startup script
COPY test-guac/guacamole-lite-server/start.js .

# Install dependencies
RUN npm install

# Expose WebSocket port and admin API port
EXPOSE 8080 3001

CMD ["node", "start.js"]