# GN Farm - Agriculture Management System

## Description

GN Farm is a comprehensive agriculture management system designed to help farmers and agricultural businesses manage their operations efficiently. The system provides features for inventory management, product tracking, sales management, and user authentication.

## Features

- User authentication with JWT (including refresh token functionality)
- Product management (fertilizers, pesticides, seeds, etc.)
- Inventory tracking with batch management
- Sales invoice management
- File upload and tracking
- Role-based access control

## Technology Stack

- Backend: NestJS (TypeScript)
- Database: PostgreSQL with TypeORM
- Authentication: JWT with refresh tokens
- File Storage: Cloudinary
- Containerization: Docker

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Docker (optional, for containerized deployment)
- PostgreSQL (if not using Docker)

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=your_username
DB_PASSWORD=your_password
DB_NAME=your_database
JWT_SECRET=your_secret_key
JWT_REFRESH_SECRET=your_refresh_secret_key
PORT=8080
```

## Installation

1. Clone the repository:

   ```bash
   git clone <repository-url>
   cd GN-ARGI
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Set up the database:
   - Create a PostgreSQL database
   - Update the `.env` file with your database credentials

4. Run database migrations:
   ```bash
   npm run migration:run
   ```

## Running the Application

### Development Mode

```bash
npm run start:dev
```

### Production Mode

```bash
npm run build
npm run start
```

### Using Docker

1. Build and run with Docker Compose:
   ```bash
   docker-compose up --build
   ```

## API Endpoints

### Authentication

- `POST /auth/login` - User login (returns access and refresh tokens)
- `POST /auth/refresh` - Refresh access token using refresh token
- `POST /auth/register` - User registration
- `PUT /auth/change-password` - Change user password (requires authentication)

### Product Management

- `GET /products` - Get all products
- `GET /products/:id` - Get a specific product
- `POST /products` - Create a new product
- `PUT /products/:id` - Update a product
- `DELETE /products/:id` - Delete a product

### Inventory Management

- `GET /inventory` - Get all inventory items
- `GET /inventory/:id` - Get a specific inventory item
- `POST /inventory/receipts` - Create a new inventory receipt
- `POST /inventory/transactions` - Create a new inventory transaction

### Sales Management

- `GET /sales/invoices` - Get all sales invoices
- `GET /sales/invoices/:id` - Get a specific sales invoice
- `POST /sales/invoices` - Create a new sales invoice
- `PUT /sales/invoices/:id` - Update a sales invoice

### File Tracking

- `POST /upload` - Upload a file
- `GET /files` - Get all uploaded files
- `GET /files/:id` - Get a specific file

## Authentication with Refresh Tokens

The application implements JWT-based authentication with refresh token functionality:

1. Login with valid credentials to receive an access token (1 hour expiry) and a refresh token (7 days expiry)
2. Use the access token in the Authorization header for authenticated requests
3. When the access token expires, use the refresh token to obtain new tokens via the `/auth/refresh` endpoint
4. Store refresh tokens securely on the client side

## Development

### Code Structure

- `src/common` - Common utilities, filters, interceptors, and middleware
- `src/config` - Configuration files
- `src/database` - Database migrations
- `src/entities` - TypeORM entities
- `src/modules` - Feature modules (auth, product, inventory, sales, user, upload, file-tracking)

### Code Quality

- ESLint for code linting
- Prettier for code formatting
- TypeScript for type safety

## Testing

Run tests with:

```bash
npm run test
```

## Deployment

The application can be deployed using Docker. Refer to the `docker-compose.yml` file for configuration details.

## License

This project is licensed under the MIT License.
