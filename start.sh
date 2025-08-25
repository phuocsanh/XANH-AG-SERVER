#!/bin/bash

# Script to start the GN application with Docker

# Default mode is production
MODE="production"

# Check for -d flag for development mode
while getopts "d" opt; do
  case $opt in
    d)
      MODE="development"
      ;;
  esac
done

echo "Starting GN application with Docker in $MODE mode..."

# Check if Docker is installed
if ! command -v docker &> /dev/null
then
    echo "Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if docker-compose is installed
if ! command -v docker-compose &> /dev/null
then
    echo "docker-compose is not installed. Please install docker-compose first."
    exit 1
fi

if [ "$MODE" = "development" ]; then
    echo "Starting in development mode..."
    docker-compose -f docker-compose.dev.yml up --build
else
    echo "Starting in production mode..."
    docker-compose up --build
fi

echo "GN application is now running!"
echo "Access the application at: http://localhost:8080"
echo "Access the API documentation at: http://localhost:8080/api"