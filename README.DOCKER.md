# Docker Deployment Guide

## Description

This guide provides instructions for deploying the GN Farm application using Docker and Docker Compose.

## Prerequisites

- Docker Engine v20.10 or higher
- Docker Compose v1.29 or higher

## Environment Variables

The application requires the following environment variables to be set:

- `DB_HOST`: Database host (default: localhost)
- `DB_PORT`: Database port (default: 5432)
- `DB_USERNAME`: Database username
- `DB_PASSWORD`: Database password
- `DB_NAME`: Database name
- `JWT_SECRET`: Secret key for JWT token signing
- `JWT_REFRESH_SECRET`: Secret key for JWT refresh token signing
- `PORT`: Application port (default: 3000)

These variables can be set in the `.env` file in the project root directory.

## Docker Compose Configuration

The project includes two Docker Compose files:

1. `docker-compose.yml` - For production deployment
2. `docker-compose.dev.yml` - For development with hot-reloading

### Services

- `app`: The NestJS application
- `db`: PostgreSQL database

## Building and Running

### Production Deployment

1. Ensure the `.env` file is properly configured
2. Build and start the services:
   ```bash
   docker-compose up --build
   ```

### Development Deployment

1. Ensure the `.env` file is properly configured
2. Build and start the services with hot-reloading:
   ```bash
   docker-compose -f docker-compose.dev.yml up --build
   ```

## Accessing the Application

Once the containers are running, the application will be available at `http://localhost:${PORT}` where `${PORT}` is the port specified in your environment variables.

## Database Migrations

Database migrations are automatically run when the application starts.

## Stopping the Application

To stop the application and remove the containers:

```bash
docker-compose down
```

To stop the application and remove both containers and volumes (data will be lost):

```bash
docker-compose down -v
```

## Troubleshooting

### Common Issues

1. **Port conflicts**: Ensure the ports specified in your `.env` file are not being used by other applications.

2. **Database connection errors**: Verify that the database credentials in your `.env` file are correct.

3. **Permission denied errors**: Ensure Docker has the necessary permissions to access the project directory.

### Logs

To view the application logs:

```bash
docker-compose logs app
```

To view the database logs:

```bash
docker-compose logs db
```

## Authentication with Refresh Tokens

The application implements JWT-based authentication with refresh token functionality:

1. Login with valid credentials to receive an access token (1 hour expiry) and a refresh token (7 days expiry)
2. Use the access token in the Authorization header for authenticated requests
3. When the access token expires, use the refresh token to obtain new tokens via the `/auth/refresh` endpoint
4. Store refresh tokens securely on the client side
