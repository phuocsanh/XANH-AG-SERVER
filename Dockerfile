# Use Node.js 20 as base image
FROM node:20

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

# Expose port
EXPOSE 3003

# Start the application with migrations in production mode
CMD ["sh", "-c", "npm run migration:run && node dist/src/main.js"]