# Docker Setup for GN

This guide explains how to run the GN application using Docker.

## Prerequisites

- Docker installed on your machine
- Docker Compose installed on your machine

## Quick Start

1. Make the start script executable:

   ```bash
   chmod +x start.sh
   ```

2. Run the application:
   ```bash
   ./start.sh
   ```

Or manually start the services:

```bash
docker-compose up --build
```

## Using npm scripts

You can also use npm scripts to manage Docker containers:

```bash
# Build Docker images
npm run docker:build

# Start services in production mode
npm run docker:up

# Stop services
npm run docker:down

# Start services in development mode (with hot-reloading)
npm run docker:up-dev

# Stop development services
npm run docker:down-dev

# View logs
npm run docker:logs
npm run docker:logs-app
npm run docker:logs-db
```

## Services

The docker-compose.yml file defines two services:

1. **db**: PostgreSQL database
   - Image: postgres:15
   - Port: 5432
   - Database name: GO_GN_FARM
   - Username: postgres
   - Password: postgres

2. **app**: NestJS application
   - Builds from the Dockerfile in the current directory
   - Port: 8080 (mapped from container port 3000)
   - Connects to the database service

## Environment Variables

The application uses the following environment variables defined in the docker-compose.yml:

- `DB_HOST`: db (the name of the database service)
- `DB_PORT`: 5432
- `DB_USERNAME`: postgres
- `DB_PASSWORD`: postgres
- `DB_NAME`: GO_GN_FARM
- `JWT_SECRET`: your-secret-key
- `PORT`: 8080

## Accessing the Application

Once the services are running:

- Application: http://localhost:8080
- API Documentation (Swagger): http://localhost:8080/api

## Stopping the Services

To stop the services:

```bash
docker-compose down
```

To stop the services and remove the volumes:

```bash
docker-compose down -v
```

## Troubleshooting

1. **Port already in use**: Make sure no other services are running on ports 8080 and 5432.

2. **Database connection issues**:
   - Check that the database service is running: `docker-compose ps`
   - Verify the environment variables in docker-compose.yml

3. **Build issues**:
   - Clean the build: `docker-compose down -v` then `docker-compose up --build`
   - Check the Dockerfile for any issues

4. **View logs**:
   - View all logs: `docker-compose logs`
   - View specific service logs: `docker-compose logs app` or `docker-compose logs db`
