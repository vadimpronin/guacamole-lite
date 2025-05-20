FROM node:22-alpine

WORKDIR /opt/guacamole-lite-server

COPY test-guac/guacamole-lite-server/start.js .

RUN mkdir guacamole-lite

COPY . guacamole-lite

WORKDIR /opt/guacamole-lite-server/guacamole-lite
RUN npm install --omit=dev

WORKDIR /opt/guacamole-lite-server

EXPOSE 8080
CMD ["node","start.js"]
