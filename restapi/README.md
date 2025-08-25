# REST API Testing

This directory contains HTTP test files for testing the GN NestJS API endpoints. These files can be used with VS Code REST Client extension or other HTTP client tools.

## Files

- [product.http](file:///Users/phuocsanh/My-Document/My-Tech/GN-Farm-Source/GN-ARGI/restapi/product.http) - Product management APIs
- [user.http](file:///Users/phuocsanh/My-Document/My-Tech/GN-Farm-Source/GN-ARGI/restapi/user.http) - User management APIs
- [inventory.http](file:///Users/phuocsanh/My-Document/My-Tech/GN-Farm-Source/GN-ARGI/restapi/inventory.http) - Inventory management APIs
- [file-tracking.http](file:///Users/phuocsanh/My-Document/My-Tech/GN-Farm-Source/GN-ARGI/restapi/file-tracking.http) - File tracking APIs

## How to Use

1. **Install VS Code REST Client Extension** (if using VS Code):
   - Open VS Code
   - Go to Extensions (Ctrl+Shift+X)
   - Search for "REST Client" and install

2. **Run the Application**:

   ```bash
   npm run docker:up-dev
   ```

3. **Test APIs**:
   - Open any `.http` file in this directory
   - Click on the "Send Request" link above any HTTP request
   - View the response in the preview panel

## API Endpoints

### Product Management

- `POST /products` - Create a new product
- `GET /products` - Get all products
- `GET /products/{id}` - Get product by ID
- `GET /products/type/{productType}` - Get products by type
- `GET /products/search?q={query}` - Search products
- `PATCH /products/{id}` - Update a product
- `DELETE /products/{id}` - Delete a product

### User Management

- `POST /users` - Create a new user
- `GET /users` - Get all users
- `GET /users/{id}` - Get user by ID
- `PATCH /users/{id}` - Update a user
- `DELETE /users/{id}` - Delete a user

### Inventory Management

- `POST /inventory/batches` - Create a new inventory batch
- `GET /inventory/batches` - Get all inventory batches
- `GET /inventory/batches/{id}` - Get inventory batch by ID
- `GET /inventory/batches/product/{productId}` - Get inventory batches by product ID
- `PATCH /inventory/batches/{id}` - Update an inventory batch
- `DELETE /inventory/batches/{id}` - Delete an inventory batch
- `POST /inventory/transactions` - Create a new inventory transaction
- `GET /inventory/transactions` - Get all inventory transactions
- `GET /inventory/transactions/product/{productId}` - Get inventory transactions by product ID
- `GET /inventory/summary/product/{productId}` - Get inventory summary by product ID
- `GET /inventory/fifo/product/{productId}` - Get FIFO value by product ID

### File Tracking

- `POST /file-tracking` - Create a new file upload record
- `GET /file-tracking` - Get all file upload records
- `GET /file-tracking/{id}` - Get file upload record by ID
- `GET /file-tracking/public/{publicId}` - Get file upload record by Public ID
- `PATCH /file-tracking/{id}` - Update a file upload record
- `DELETE /file-tracking/{id}` - Delete a file upload record
- `GET /file-tracking/orphaned` - Get orphaned files
- `PATCH /file-tracking/{id}/mark-for-deletion` - Mark file for deletion
- `GET /file-tracking/marked-for-deletion` - Get files marked for deletion

## Notes

- Make sure the application is running on `http://localhost:8080` before testing
- Some endpoints may require authentication (Bearer token)
- Update the request data as needed for your testing
