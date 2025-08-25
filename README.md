# GN - NestJS Server

This is a NestJS implementation of the GN application, originally built with Go.

## Features

- Product Management (Mushrooms, Vegetables, Bonsai)
- User Management and Authentication
- Inventory Management with FIFO tracking
- File Upload and Tracking System
- RESTful API with Swagger Documentation
- PostgreSQL Database Integration

## Prerequisites

- Node.js (v14 or higher)
- PostgreSQL database
- npm or yarn
- Docker and Docker Compose (recommended)

## Installation

```bash
# Install dependencies
npm install

# Set up environment variables
# Copy .env.example to .env and update the values
cp .env.example .env
```

## Docker Setup (Recommended)

The easiest way to run the application is with Docker. See [README.DOCKER.md](README.DOCKER.md) for detailed instructions.

### Quick Start with Docker

1. Make the start script executable:

   ```bash
   chmod +x start.sh
   ```

2. Run the application:
   ```bash
   ./start.sh
   ```

### Using npm scripts for Docker

```bash
# Build Docker images
npm run docker:build

# Start services in production mode
npm run docker:up

# Stop services
npm run docker:down

# Start services in development mode
npm run docker:up-dev

# Stop development services
npm run docker:down-dev

# View logs
npm run docker:logs
npm run docker:logs-app
npm run docker:logs-db
```

Or manually start the services:

```bash
# For production
docker-compose up --build

# For development
docker-compose -f docker-compose.dev.yml up --build
```

## Manual Setup (Without Docker)

### Configuration

Update the `.env` file with your database credentials:

```
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=your_username
DB_PASSWORD=your_password
DB_NAME=your_database
JWT_SECRET=your_secret_key
PORT=8080
```

### Running the Application

```bash
# Development mode
npm run start:dev

# Production mode
npm run build
npm run start:prod
```

## API Documentation

Once the application is running, you can access the Swagger API documentation at:

- http://localhost:8080/api

## Project Structure

```
src/
├── common/          # Shared utilities, guards, interceptors, pipes
├── config/          # Configuration files
├── database/        # Database migrations
├── dto/             # Data Transfer Objects
├── entities/        # TypeORM entities
├── interfaces/      # TypeScript interfaces
├── modules/         # Feature modules
│   ├── file-tracking/
│   ├── inventory/
│   ├── product/
│   └── user/
└── utils/           # Utility functions
```

## Modules

### Product Module

- Manage different types of products (Mushrooms, Vegetables, Bonsai)
- CRUD operations for products
- Product search and filtering

### User Module

- User registration and authentication
- User profile management
- Two-factor authentication support

### Inventory Module

- Track inventory batches with FIFO method
- Manage inventory transactions
- Calculate average cost pricing

### File Tracking Module

- Upload file management
- Reference counting for files
- Orphaned file detection and cleanup

### Authentication Module

- JWT-based authentication
- Password hashing with bcrypt
- Login and registration endpoints

## Testing the Application

You can test the application using the provided test script:

```bash
chmod +x test-app.sh
./test-app.sh
```

Or manually using curl:

```bash
# User registration
curl -X POST http://localhost:8080/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "userAccount": "testuser@example.com",
    "userPassword": "password123",
    "userSalt": "salt123",
    "userEmail": "testuser@example.com",
    "userState": 1
  }'

# User login
curl -X POST http://localhost:8080/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "userAccount": "testuser@example.com",
    "userPassword": "password123"
  }'
```

## Development

### Adding a New Module

1. Create a new module directory in `src/modules/`
2. Create the entity in `src/entities/`
3. Create service, controller, and DTOs
4. Register the module in `src/app.module.ts`

### Database Migrations

```bash
# Generate a new migration
npm run typeorm migration:generate -- -n MigrationName

# Run migrations
npm run typeorm migration:run
```

## Testing

```bash
# Run unit tests
npm run test

# Run end-to-end tests
npm run test:e2e

# Run tests with coverage
npm run test:cov
```

## Production Deployment

For production deployment, make sure to:

1. Update the `.env` file with production database credentials
2. Set a strong JWT secret
3. Use the production Docker setup:
   ```bash
   docker-compose up --build
   ```
4. Access the application at http://localhost:8080
5. Access the API documentation at http://localhost:8080/api