FROM node:20-alpine

WORKDIR /app

# Copy package manifest files first to leverage Docker layer caching
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy application source code
COPY src/ ./src/

# Expose default application port
EXPOSE 3000

# Default command starts the Express webhook server
CMD ["node", "src/index.js"]
