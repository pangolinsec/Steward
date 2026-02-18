FROM node:20-alpine

WORKDIR /app

# Install server dependencies
COPY server/package.json server/package-lock.json* ./server/
RUN cd server && npm install --production

# Install client dependencies and build
COPY client/package.json client/package-lock.json* ./client/
RUN cd client && npm install

COPY client/ ./client/
RUN cd client && npm run build

# Copy server source
COPY server/ ./server/

# Data directory
RUN mkdir -p /data
ENV STEWARD_DATA_DIR=/data
ENV PORT=3000

EXPOSE 3000

CMD ["node", "server/src/index.js"]
