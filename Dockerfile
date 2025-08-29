# Use Node.js 18 as base image
FROM node:18

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies for development mode)
RUN npm install

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Run database migrations
RUN npm run migration:run

# Expose port
EXPOSE 8080

# Start the application in production mode
CMD ["node", "dist/src/main.js"]