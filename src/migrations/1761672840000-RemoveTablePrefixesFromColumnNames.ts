import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveTablePrefixesFromColumnNames1761672840000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Update products table
    await queryRunner.renameColumn('products', 'product_name', 'name');
    await queryRunner.renameColumn('products', 'product_price', 'price');
    await queryRunner.renameColumn('products', 'product_thumb', 'thumb');
    await queryRunner.renameColumn('products', 'product_pictures', 'pictures');
    await queryRunner.renameColumn('products', 'product_videos', 'videos');
    await queryRunner.renameColumn(
      'products',
      'product_ratings_average',
      'ratings_average',
    );
    await queryRunner.renameColumn(
      'products',
      'product_description',
      'description',
    );
    await queryRunner.renameColumn('products', 'product_slug', 'slug');
    await queryRunner.renameColumn('products', 'product_quantity', 'quantity');
    await queryRunner.renameColumn('products', 'product_type', 'type');
    await queryRunner.renameColumn(
      'products',
      'product_discounted_price',
      'discounted_price',
    );
    await queryRunner.renameColumn('products', 'product_selled', 'selled');
    await queryRunner.renameColumn(
      'products',
      'product_attributes',
      'attributes',
    );

    // Update inventories table
    await queryRunner.renameColumn('inventories', 'batch_code', 'code');
    await queryRunner.renameColumn(
      'inventories',
      'unit_cost_price',
      'unit_cost_price',
    );
    await queryRunner.renameColumn(
      'inventories',
      'original_quantity',
      'original_quantity',
    );
    await queryRunner.renameColumn(
      'inventories',
      'remaining_quantity',
      'remaining_quantity',
    );
    await queryRunner.renameColumn('inventories', 'expiry_date', 'expiry_date');
    await queryRunner.renameColumn(
      'inventories',
      'manufacturing_date',
      'manufacturing_date',
    );
    await queryRunner.renameColumn('inventories', 'supplier_id', 'supplier_id');
    await queryRunner.renameColumn('inventories', 'notes', 'notes');
    await queryRunner.renameColumn(
      'inventories',
      'receipt_item_id',
      'receipt_item_id',
    );

    // Update inventory_receipts table
    await queryRunner.renameColumn(
      'inventory_receipts',
      'receipt_code',
      'code',
    );
    await queryRunner.renameColumn(
      'inventory_receipts',
      'supplier_id',
      'supplier_id',
    );
    await queryRunner.renameColumn(
      'inventory_receipts',
      'total_amount',
      'total_amount',
    );
    await queryRunner.renameColumn('inventory_receipts', 'status', 'status');
    await queryRunner.renameColumn('inventory_receipts', 'notes', 'notes');
    await queryRunner.renameColumn(
      'inventory_receipts',
      'created_by',
      'created_by',
    );
    await queryRunner.renameColumn(
      'inventory_receipts',
      'updated_by',
      'updated_by',
    );
    await queryRunner.renameColumn(
      'inventory_receipts',
      'deleted_by',
      'deleted_by',
    );
    await queryRunner.renameColumn(
      'inventory_receipts',
      'approved_at',
      'approved_at',
    );
    await queryRunner.renameColumn(
      'inventory_receipts',
      'completed_at',
      'completed_at',
    );
    await queryRunner.renameColumn(
      'inventory_receipts',
      'cancelled_at',
      'cancelled_at',
    );
    await queryRunner.renameColumn(
      'inventory_receipts',
      'cancelled_reason',
      'cancelled_reason',
    );
    await queryRunner.renameColumn(
      'inventory_receipts',
      'deleted_at',
      'deleted_at',
    );

    // Update inventory_transactions table
    await queryRunner.renameColumn(
      'inventory_transactions',
      'product_id',
      'product_id',
    );
    await queryRunner.renameColumn('inventory_transactions', 'type', 'type');
    await queryRunner.renameColumn(
      'inventory_transactions',
      'unit_cost_price',
      'unit_cost_price',
    );
    await queryRunner.renameColumn(
      'inventory_transactions',
      'total_value',
      'total_value',
    );
    await queryRunner.renameColumn(
      'inventory_transactions',
      'remaining_quantity',
      'remaining_quantity',
    );
    await queryRunner.renameColumn(
      'inventory_transactions',
      'new_average_cost',
      'new_average_cost',
    );
    await queryRunner.renameColumn(
      'inventory_transactions',
      'receipt_item_id',
      'receipt_item_id',
    );
    await queryRunner.renameColumn(
      'inventory_transactions',
      'reference_type',
      'reference_type',
    );
    await queryRunner.renameColumn(
      'inventory_transactions',
      'reference_id',
      'reference_id',
    );
    await queryRunner.renameColumn('inventory_transactions', 'notes', 'notes');
    await queryRunner.renameColumn(
      'inventory_transactions',
      'created_by',
      'created_by',
    );
    await queryRunner.renameColumn(
      'inventory_transactions',
      'created_at',
      'created_at',
    );
    await queryRunner.renameColumn(
      'inventory_transactions',
      'updated_at',
      'updated_at',
    );
    await queryRunner.renameColumn(
      'inventory_transactions',
      'deleted_at',
      'deleted_at',
    );

    // Update sales_invoices table
    await queryRunner.renameColumn('sales_invoices', 'invoice_code', 'code');
    await queryRunner.renameColumn(
      'sales_invoices',
      'customer_name',
      'customer_name',
    );
    await queryRunner.renameColumn(
      'sales_invoices',
      'customer_phone',
      'customer_phone',
    );
    await queryRunner.renameColumn(
      'sales_invoices',
      'customer_email',
      'customer_email',
    );
    await queryRunner.renameColumn(
      'sales_invoices',
      'customer_address',
      'customer_address',
    );
    await queryRunner.renameColumn(
      'sales_invoices',
      'total_amount',
      'total_amount',
    );
    await queryRunner.renameColumn(
      'sales_invoices',
      'discount_amount',
      'discount_amount',
    );
    await queryRunner.renameColumn(
      'sales_invoices',
      'final_amount',
      'final_amount',
    );
    await queryRunner.renameColumn(
      'sales_invoices',
      'payment_method',
      'payment_method',
    );
    await queryRunner.renameColumn(
      'sales_invoices',
      'payment_status',
      'payment_status',
    );
    await queryRunner.renameColumn('sales_invoices', 'notes', 'notes');
    await queryRunner.renameColumn(
      'sales_invoices',
      'created_by',
      'created_by',
    );
    await queryRunner.renameColumn('sales_invoices', 'status', 'status');
    await queryRunner.renameColumn(
      'sales_invoices',
      'created_at',
      'created_at',
    );
    await queryRunner.renameColumn(
      'sales_invoices',
      'updated_at',
      'updated_at',
    );
    await queryRunner.renameColumn(
      'sales_invoices',
      'deleted_at',
      'deleted_at',
    );

    // Update file_uploads table
    await queryRunner.renameColumn('file_uploads', 'public_id', 'public_id');
    await queryRunner.renameColumn('file_uploads', 'file_url', 'url');
    await queryRunner.renameColumn('file_uploads', 'file_name', 'name');
    await queryRunner.renameColumn('file_uploads', 'file_type', 'type');
    await queryRunner.renameColumn('file_uploads', 'file_size', 'size');
    await queryRunner.renameColumn('file_uploads', 'folder', 'folder');
    await queryRunner.renameColumn('file_uploads', 'mime_type', 'mime_type');
    await queryRunner.renameColumn(
      'file_uploads',
      'reference_count',
      'reference_count',
    );
    await queryRunner.renameColumn(
      'file_uploads',
      'is_temporary',
      'is_temporary',
    );
    await queryRunner.renameColumn(
      'file_uploads',
      'is_orphaned',
      'is_orphaned',
    );
    await queryRunner.renameColumn(
      'file_uploads',
      'uploaded_by_user_id',
      'uploaded_by',
    );
    await queryRunner.renameColumn('file_uploads', 'metadata', 'metadata');
    await queryRunner.renameColumn('file_uploads', 'created_at', 'created_at');
    await queryRunner.renameColumn('file_uploads', 'updated_at', 'updated_at');
    await queryRunner.renameColumn(
      'file_uploads',
      'marked_for_deletion_at',
      'marked_for_deletion_at',
    );
    await queryRunner.renameColumn('file_uploads', 'deleted_at', 'deleted_at');

    // Update file_references table
    await queryRunner.renameColumn('file_references', 'file_id', 'file_id');
    await queryRunner.renameColumn(
      'file_references',
      'entity_type',
      'entity_type',
    );
    await queryRunner.renameColumn('file_references', 'entity_id', 'entity_id');
    await queryRunner.renameColumn(
      'file_references',
      'field_name',
      'field_name',
    );
    await queryRunner.renameColumn(
      'file_references',
      'array_index',
      'array_index',
    );
    await queryRunner.renameColumn(
      'file_references',
      'created_by',
      'created_by',
    );
    await queryRunner.renameColumn(
      'file_references',
      'deleted_by',
      'deleted_by',
    );
    await queryRunner.renameColumn(
      'file_references',
      'created_at',
      'created_at',
    );
    await queryRunner.renameColumn(
      'file_references',
      'updated_at',
      'updated_at',
    );
    await queryRunner.renameColumn(
      'file_references',
      'deleted_at',
      'deleted_at',
    );

    // Update product_types table
    await queryRunner.renameColumn('product_types', 'type_name', 'name');
    await queryRunner.renameColumn('product_types', 'type_code', 'code');
    await queryRunner.renameColumn(
      'product_types',
      'description',
      'description',
    );
    await queryRunner.renameColumn('product_types', 'status', 'status');
    await queryRunner.renameColumn('product_types', 'created_at', 'created_at');
    await queryRunner.renameColumn('product_types', 'updated_at', 'updated_at');
    await queryRunner.renameColumn('product_types', 'deleted_at', 'deleted_at');

    // Update product_subtypes table
    await queryRunner.renameColumn('product_subtypes', 'subtype_name', 'name');
    await queryRunner.renameColumn('product_subtypes', 'subtype_code', 'code');
    await queryRunner.renameColumn(
      'product_subtypes',
      'product_type_id',
      'product_type_id',
    );
    await queryRunner.renameColumn(
      'product_subtypes',
      'description',
      'description',
    );
    await queryRunner.renameColumn('product_subtypes', 'status', 'status');
    await queryRunner.renameColumn(
      'product_subtypes',
      'created_at',
      'created_at',
    );
    await queryRunner.renameColumn(
      'product_subtypes',
      'updated_at',
      'updated_at',
    );
    await queryRunner.renameColumn(
      'product_subtypes',
      'deleted_at',
      'deleted_at',
    );

    // Update symbols table
    await queryRunner.renameColumn('symbols', 'symbol_code', 'code');
    await queryRunner.renameColumn('symbols', 'symbol_name', 'name');
    await queryRunner.renameColumn('symbols', 'description', 'description');
    await queryRunner.renameColumn('symbols', 'status', 'status');
    await queryRunner.renameColumn('symbols', 'created_at', 'created_at');
    await queryRunner.renameColumn('symbols', 'updated_at', 'updated_at');
    await queryRunner.renameColumn('symbols', 'deleted_at', 'deleted_at');

    // Update units table
    await queryRunner.renameColumn('units', 'unit_name', 'name');
    await queryRunner.renameColumn('units', 'unit_code', 'code');
    await queryRunner.renameColumn('units', 'description', 'description');
    await queryRunner.renameColumn('units', 'status', 'status');
    await queryRunner.renameColumn('units', 'created_at', 'created_at');
    await queryRunner.renameColumn('units', 'updated_at', 'updated_at');
    await queryRunner.renameColumn('units', 'deleted_at', 'deleted_at');

    // Update user_profiles table
    await queryRunner.renameColumn('user_profiles', 'user_account', 'account');
    await queryRunner.renameColumn(
      'user_profiles',
      'user_nickname',
      'nickname',
    );
    await queryRunner.renameColumn('user_profiles', 'user_avatar', 'avatar');
    await queryRunner.renameColumn('user_profiles', 'user_mobile', 'mobile');
    await queryRunner.renameColumn('user_profiles', 'user_gender', 'gender');
    await queryRunner.renameColumn(
      'user_profiles',
      'user_birthday',
      'birthday',
    );
    await queryRunner.renameColumn('user_profiles', 'user_email', 'email');
    await queryRunner.renameColumn(
      'user_profiles',
      'user_is_authentication',
      'is_authentication',
    );
    await queryRunner.renameColumn('user_profiles', 'created_at', 'created_at');
    await queryRunner.renameColumn('user_profiles', 'updated_at', 'updated_at');
    await queryRunner.renameColumn('user_profiles', 'deleted_at', 'deleted_at');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert user_profiles table
    await queryRunner.renameColumn('user_profiles', 'account', 'user_account');
    await queryRunner.renameColumn(
      'user_profiles',
      'nickname',
      'user_nickname',
    );
    await queryRunner.renameColumn('user_profiles', 'avatar', 'user_avatar');
    await queryRunner.renameColumn('user_profiles', 'mobile', 'user_mobile');
    await queryRunner.renameColumn('user_profiles', 'gender', 'user_gender');
    await queryRunner.renameColumn(
      'user_profiles',
      'birthday',
      'user_birthday',
    );
    await queryRunner.renameColumn('user_profiles', 'email', 'user_email');
    await queryRunner.renameColumn(
      'user_profiles',
      'is_authentication',
      'user_is_authentication',
    );
    await queryRunner.renameColumn('user_profiles', 'created_at', 'created_at');
    await queryRunner.renameColumn('user_profiles', 'updated_at', 'updated_at');
    await queryRunner.renameColumn('user_profiles', 'deleted_at', 'deleted_at');

    // Revert units table
    await queryRunner.renameColumn('units', 'name', 'unit_name');
    await queryRunner.renameColumn('units', 'code', 'unit_code');
    await queryRunner.renameColumn('units', 'description', 'description');
    await queryRunner.renameColumn('units', 'status', 'status');
    await queryRunner.renameColumn('units', 'created_at', 'created_at');
    await queryRunner.renameColumn('units', 'updated_at', 'updated_at');
    await queryRunner.renameColumn('units', 'deleted_at', 'deleted_at');

    // Revert symbols table
    await queryRunner.renameColumn('symbols', 'code', 'symbol_code');
    await queryRunner.renameColumn('symbols', 'name', 'symbol_name');
    await queryRunner.renameColumn('symbols', 'description', 'description');
    await queryRunner.renameColumn('symbols', 'status', 'status');
    await queryRunner.renameColumn('symbols', 'created_at', 'created_at');
    await queryRunner.renameColumn('symbols', 'updated_at', 'updated_at');
    await queryRunner.renameColumn('symbols', 'deleted_at', 'deleted_at');

    // Revert product_subtypes table
    await queryRunner.renameColumn('product_subtypes', 'name', 'subtype_name');
    await queryRunner.renameColumn('product_subtypes', 'code', 'subtype_code');
    await queryRunner.renameColumn(
      'product_subtypes',
      'product_type_id',
      'product_type_id',
    );
    await queryRunner.renameColumn(
      'product_subtypes',
      'description',
      'description',
    );
    await queryRunner.renameColumn('product_subtypes', 'status', 'status');
    await queryRunner.renameColumn(
      'product_subtypes',
      'created_at',
      'created_at',
    );
    await queryRunner.renameColumn(
      'product_subtypes',
      'updated_at',
      'updated_at',
    );
    await queryRunner.renameColumn(
      'product_subtypes',
      'deleted_at',
      'deleted_at',
    );

    // Revert product_types table
    await queryRunner.renameColumn('product_types', 'name', 'type_name');
    await queryRunner.renameColumn('product_types', 'code', 'type_code');
    await queryRunner.renameColumn(
      'product_types',
      'description',
      'description',
    );
    await queryRunner.renameColumn('product_types', 'status', 'status');
    await queryRunner.renameColumn('product_types', 'created_at', 'created_at');
    await queryRunner.renameColumn('product_types', 'updated_at', 'updated_at');
    await queryRunner.renameColumn('product_types', 'deleted_at', 'deleted_at');

    // Revert file_references table
    await queryRunner.renameColumn('file_references', 'file_id', 'file_id');
    await queryRunner.renameColumn(
      'file_references',
      'entity_type',
      'entity_type',
    );
    await queryRunner.renameColumn('file_references', 'entity_id', 'entity_id');
    await queryRunner.renameColumn(
      'file_references',
      'field_name',
      'field_name',
    );
    await queryRunner.renameColumn(
      'file_references',
      'array_index',
      'array_index',
    );
    await queryRunner.renameColumn(
      'file_references',
      'created_by',
      'created_by',
    );
    await queryRunner.renameColumn(
      'file_references',
      'deleted_by',
      'deleted_by',
    );
    await queryRunner.renameColumn(
      'file_references',
      'created_at',
      'created_at',
    );
    await queryRunner.renameColumn(
      'file_references',
      'updated_at',
      'updated_at',
    );
    await queryRunner.renameColumn(
      'file_references',
      'deleted_at',
      'deleted_at',
    );

    // Revert file_uploads table
    await queryRunner.renameColumn('file_uploads', 'public_id', 'public_id');
    await queryRunner.renameColumn('file_uploads', 'url', 'file_url');
    await queryRunner.renameColumn('file_uploads', 'name', 'file_name');
    await queryRunner.renameColumn('file_uploads', 'type', 'file_type');
    await queryRunner.renameColumn('file_uploads', 'size', 'file_size');
    await queryRunner.renameColumn('file_uploads', 'folder', 'folder');
    await queryRunner.renameColumn('file_uploads', 'mime_type', 'mime_type');
    await queryRunner.renameColumn(
      'file_uploads',
      'reference_count',
      'reference_count',
    );
    await queryRunner.renameColumn(
      'file_uploads',
      'is_temporary',
      'is_temporary',
    );
    await queryRunner.renameColumn(
      'file_uploads',
      'is_orphaned',
      'is_orphaned',
    );
    await queryRunner.renameColumn(
      'file_uploads',
      'uploaded_by',
      'uploaded_by_user_id',
    );
    await queryRunner.renameColumn('file_uploads', 'metadata', 'metadata');
    await queryRunner.renameColumn('file_uploads', 'created_at', 'created_at');
    await queryRunner.renameColumn('file_uploads', 'updated_at', 'updated_at');
    await queryRunner.renameColumn(
      'file_uploads',
      'marked_for_deletion_at',
      'marked_for_deletion_at',
    );
    await queryRunner.renameColumn('file_uploads', 'deleted_at', 'deleted_at');

    // Revert sales_invoices table
    await queryRunner.renameColumn('sales_invoices', 'code', 'invoice_code');
    await queryRunner.renameColumn(
      'sales_invoices',
      'customer_name',
      'customer_name',
    );
    await queryRunner.renameColumn(
      'sales_invoices',
      'customer_phone',
      'customer_phone',
    );
    await queryRunner.renameColumn(
      'sales_invoices',
      'customer_email',
      'customer_email',
    );
    await queryRunner.renameColumn(
      'sales_invoices',
      'customer_address',
      'customer_address',
    );
    await queryRunner.renameColumn(
      'sales_invoices',
      'total_amount',
      'total_amount',
    );
    await queryRunner.renameColumn(
      'sales_invoices',
      'discount_amount',
      'discount_amount',
    );
    await queryRunner.renameColumn(
      'sales_invoices',
      'final_amount',
      'final_amount',
    );
    await queryRunner.renameColumn(
      'sales_invoices',
      'payment_method',
      'payment_method',
    );
    await queryRunner.renameColumn(
      'sales_invoices',
      'payment_status',
      'payment_status',
    );
    await queryRunner.renameColumn('sales_invoices', 'notes', 'notes');
    await queryRunner.renameColumn(
      'sales_invoices',
      'created_by',
      'created_by',
    );
    await queryRunner.renameColumn('sales_invoices', 'status', 'status');
    await queryRunner.renameColumn(
      'sales_invoices',
      'created_at',
      'created_at',
    );
    await queryRunner.renameColumn(
      'sales_invoices',
      'updated_at',
      'updated_at',
    );
    await queryRunner.renameColumn(
      'sales_invoices',
      'deleted_at',
      'deleted_at',
    );

    // Revert inventory_transactions table
    await queryRunner.renameColumn(
      'inventory_transactions',
      'product_id',
      'product_id',
    );
    await queryRunner.renameColumn('inventory_transactions', 'type', 'type');
    await queryRunner.renameColumn(
      'inventory_transactions',
      'unit_cost_price',
      'unit_cost_price',
    );
    await queryRunner.renameColumn(
      'inventory_transactions',
      'total_value',
      'total_cost_value',
    );
    await queryRunner.renameColumn(
      'inventory_transactions',
      'remaining_quantity',
      'remaining_quantity',
    );
    await queryRunner.renameColumn(
      'inventory_transactions',
      'new_average_cost',
      'new_average_cost',
    );
    await queryRunner.renameColumn(
      'inventory_transactions',
      'receipt_item_id',
      'receipt_item_id',
    );
    await queryRunner.renameColumn(
      'inventory_transactions',
      'reference_type',
      'reference_type',
    );
    await queryRunner.renameColumn(
      'inventory_transactions',
      'reference_id',
      'reference_id',
    );
    await queryRunner.renameColumn('inventory_transactions', 'notes', 'notes');
    await queryRunner.renameColumn(
      'inventory_transactions',
      'created_by',
      'created_by_user_id',
    );
    await queryRunner.renameColumn(
      'inventory_transactions',
      'created_at',
      'created_at',
    );
    await queryRunner.renameColumn(
      'inventory_transactions',
      'updated_at',
      'updated_at',
    );
    await queryRunner.renameColumn(
      'inventory_transactions',
      'deleted_at',
      'deleted_at',
    );

    // Revert inventory_receipts table
    await queryRunner.renameColumn(
      'inventory_receipts',
      'code',
      'receipt_code',
    );
    await queryRunner.renameColumn(
      'inventory_receipts',
      'supplier_id',
      'supplier_id',
    );
    await queryRunner.renameColumn(
      'inventory_receipts',
      'total_amount',
      'total_amount',
    );
    await queryRunner.renameColumn('inventory_receipts', 'status', 'status');
    await queryRunner.renameColumn('inventory_receipts', 'notes', 'notes');
    await queryRunner.renameColumn(
      'inventory_receipts',
      'created_by',
      'created_by',
    );
    await queryRunner.renameColumn(
      'inventory_receipts',
      'updated_by',
      'updated_by',
    );
    await queryRunner.renameColumn(
      'inventory_receipts',
      'deleted_by',
      'deleted_by',
    );
    await queryRunner.renameColumn(
      'inventory_receipts',
      'approved_at',
      'approved_at',
    );
    await queryRunner.renameColumn(
      'inventory_receipts',
      'completed_at',
      'completed_at',
    );
    await queryRunner.renameColumn(
      'inventory_receipts',
      'cancelled_at',
      'cancelled_at',
    );
    await queryRunner.renameColumn(
      'inventory_receipts',
      'cancelled_reason',
      'cancelled_reason',
    );
    await queryRunner.renameColumn(
      'inventory_receipts',
      'deleted_at',
      'deleted_at',
    );

    // Revert inventories table
    await queryRunner.renameColumn('inventories', 'code', 'batch_code');
    await queryRunner.renameColumn(
      'inventories',
      'unit_cost_price',
      'unit_cost_price',
    );
    await queryRunner.renameColumn(
      'inventories',
      'original_quantity',
      'original_quantity',
    );
    await queryRunner.renameColumn(
      'inventories',
      'remaining_quantity',
      'remaining_quantity',
    );
    await queryRunner.renameColumn('inventories', 'expiry_date', 'expiry_date');
    await queryRunner.renameColumn(
      'inventories',
      'manufacturing_date',
      'manufacturing_date',
    );
    await queryRunner.renameColumn('inventories', 'supplier_id', 'supplier_id');
    await queryRunner.renameColumn('inventories', 'notes', 'notes');
    await queryRunner.renameColumn(
      'inventories',
      'receipt_item_id',
      'receipt_item_id',
    );

    // Revert products table
    await queryRunner.renameColumn('products', 'name', 'product_name');
    await queryRunner.renameColumn('products', 'price', 'product_price');
    await queryRunner.renameColumn('products', 'thumb', 'product_thumb');
    await queryRunner.renameColumn('products', 'pictures', 'product_pictures');
    await queryRunner.renameColumn('products', 'videos', 'product_videos');
    await queryRunner.renameColumn(
      'products',
      'ratings_average',
      'product_ratings_average',
    );
    await queryRunner.renameColumn(
      'products',
      'description',
      'product_description',
    );
    await queryRunner.renameColumn('products', 'slug', 'product_slug');
    await queryRunner.renameColumn('products', 'quantity', 'product_quantity');
    await queryRunner.renameColumn('products', 'type', 'product_type');
    await queryRunner.renameColumn(
      'products',
      'discounted_price',
      'product_discounted_price',
    );
    await queryRunner.renameColumn('products', 'selled', 'product_selled');
    await queryRunner.renameColumn(
      'products',
      'attributes',
      'product_attributes',
    );
  }
}
