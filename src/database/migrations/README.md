# Database Migrations

This directory contains all the database migration scripts for the application.

## Running Migrations

To run all pending migrations:

```bash
npm run migration:run
```

## Creating New Migrations

To generate a new migration based on changes in entities:

```bash
npm run migration:generate -- src/database/migrations/MigrationName
```

To create a new empty migration:

```bash
npm run migration:create -- src/database/migrations/MigrationName
```

## Reverting Migrations

To revert the last applied migration:

```bash
npm run migration:revert
```

## Migration Order

Migrations are executed in alphabetical order based on their filenames. The timestamp prefix ensures they run in the correct chronological order:

1. CreateUserTable
2. CreateUserProfileTable
3. CreateProductTypeTable
4. CreateProductSubtypeTable
5. CreateProductTable
6. CreateProductSubtypeRelationTable
7. CreateFileUploadTable
8. CreateInventoryTable
9. CreateInventoryReceiptTable
10. CreateInventoryReceiptItemTable
11. CreateInventoryTransactionTable
12. CreateSalesInvoiceTable
13. CreateSalesInvoiceItemTable

## Important Notes

- Always backup your database before running migrations in production
- Test migrations in a development environment first
- Migration files should never be modified once they have been run in production
- Use `migration:generate` to automatically generate migrations based on entity changes
