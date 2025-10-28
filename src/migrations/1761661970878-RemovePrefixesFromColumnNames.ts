import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemovePrefixesFromColumnNames1761661970878
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

    // Update users table
    await queryRunner.renameColumn('users', 'user_id', 'id');
    await queryRunner.renameColumn('users', 'user_account', 'account');
    await queryRunner.renameColumn('users', 'user_password', 'password');
    await queryRunner.renameColumn('users', 'user_salt', 'salt');
    await queryRunner.renameColumn('users', 'user_login_time', 'login_time');
    await queryRunner.renameColumn('users', 'user_logout_time', 'logout_time');
    await queryRunner.renameColumn('users', 'user_login_ip', 'login_ip');
    await queryRunner.renameColumn('users', 'user_created_at', 'created_at');
    await queryRunner.renameColumn('users', 'user_updated_at', 'updated_at');

    // Update user_profiles table
    await queryRunner.renameColumn('user_profiles', 'user_id', 'id');
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

    // Update inventory_receipts table
    await queryRunner.renameColumn(
      'inventory_receipts',
      'receipt_code',
      'code',
    );

    // Update inventories table
    await queryRunner.renameColumn('inventories', 'batch_code', 'code');

    // Update inventory_transactions table
    await queryRunner.renameColumn(
      'inventory_transactions',
      'transaction_type',
      'type',
    );
    await queryRunner.renameColumn(
      'inventory_transactions',
      'total_cost_value',
      'total_value',
    );
    await queryRunner.renameColumn(
      'inventory_transactions',
      'new_average_cost',
      'new_average_cost',
    );
    await queryRunner.renameColumn(
      'inventory_transactions',
      'created_by_user_id',
      'created_by',
    );

    // Update sales_invoices table
    await queryRunner.renameColumn('sales_invoices', 'invoice_code', 'code');
    await queryRunner.renameColumn(
      'sales_invoices',
      'created_by_user_id',
      'created_by',
    );

    // Update file_uploads table
    await queryRunner.renameColumn('file_uploads', 'file_url', 'url');
    await queryRunner.renameColumn('file_uploads', 'file_name', 'name');
    await queryRunner.renameColumn('file_uploads', 'file_type', 'type');
    await queryRunner.renameColumn('file_uploads', 'file_size', 'size');

    // Update file_references table
    await queryRunner.renameColumn(
      'file_references',
      'created_by_user_id',
      'created_by',
    );
    await queryRunner.renameColumn(
      'file_references',
      'deleted_by_user_id',
      'deleted_by',
    );

    // Update product_types table
    await queryRunner.renameColumn('product_types', 'type_name', 'name');
    await queryRunner.renameColumn('product_types', 'type_code', 'code');

    // Update product_subtypes table
    await queryRunner.renameColumn('product_subtypes', 'subtype_name', 'name');
    await queryRunner.renameColumn('product_subtypes', 'subtype_code', 'code');

    // Update symbols table
    await queryRunner.renameColumn('symbols', 'symbol_code', 'code');
    await queryRunner.renameColumn('symbols', 'symbol_name', 'name');

    // Update units table
    await queryRunner.renameColumn('units', 'unit_name', 'name');
    await queryRunner.renameColumn('units', 'unit_code', 'code');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
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

    // Revert users table
    await queryRunner.renameColumn('users', 'id', 'user_id');
    await queryRunner.renameColumn('users', 'account', 'user_account');
    await queryRunner.renameColumn('users', 'password', 'user_password');
    await queryRunner.renameColumn('users', 'salt', 'user_salt');
    await queryRunner.renameColumn('users', 'login_time', 'user_login_time');
    await queryRunner.renameColumn('users', 'logout_time', 'user_logout_time');
    await queryRunner.renameColumn('users', 'login_ip', 'user_login_ip');
    await queryRunner.renameColumn('users', 'created_at', 'user_created_at');
    await queryRunner.renameColumn('users', 'updated_at', 'user_updated_at');

    // Revert user_profiles table
    await queryRunner.renameColumn('user_profiles', 'id', 'user_id');
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

    // Revert inventory_receipts table
    await queryRunner.renameColumn(
      'inventory_receipts',
      'code',
      'receipt_code',
    );

    // Revert inventories table
    await queryRunner.renameColumn('inventories', 'code', 'batch_code');

    // Revert inventory_transactions table
    await queryRunner.renameColumn(
      'inventory_transactions',
      'type',
      'transaction_type',
    );
    await queryRunner.renameColumn(
      'inventory_transactions',
      'total_value',
      'total_cost_value',
    );
    await queryRunner.renameColumn(
      'inventory_transactions',
      'new_average_cost',
      'new_average_cost',
    );
    await queryRunner.renameColumn(
      'inventory_transactions',
      'created_by',
      'created_by_user_id',
    );

    // Revert sales_invoices table
    await queryRunner.renameColumn('sales_invoices', 'code', 'invoice_code');
    await queryRunner.renameColumn(
      'sales_invoices',
      'created_by',
      'created_by_user_id',
    );

    // Revert file_uploads table
    await queryRunner.renameColumn('file_uploads', 'url', 'file_url');
    await queryRunner.renameColumn('file_uploads', 'name', 'file_name');
    await queryRunner.renameColumn('file_uploads', 'type', 'file_type');
    await queryRunner.renameColumn('file_uploads', 'size', 'file_size');

    // Revert file_references table
    await queryRunner.renameColumn(
      'file_references',
      'created_by',
      'created_by_user_id',
    );
    await queryRunner.renameColumn(
      'file_references',
      'deleted_by',
      'deleted_by_user_id',
    );

    // Revert product_types table
    await queryRunner.renameColumn('product_types', 'name', 'type_name');
    await queryRunner.renameColumn('product_types', 'code', 'type_code');

    // Revert product_subtypes table
    await queryRunner.renameColumn('product_subtypes', 'name', 'subtype_name');
    await queryRunner.renameColumn('product_subtypes', 'code', 'subtype_code');

    // Revert symbols table
    await queryRunner.renameColumn('symbols', 'code', 'symbol_code');
    await queryRunner.renameColumn('symbols', 'name', 'symbol_name');

    // Revert units table
    await queryRunner.renameColumn('units', 'name', 'unit_name');
    await queryRunner.renameColumn('units', 'code', 'unit_code');
  }
}
