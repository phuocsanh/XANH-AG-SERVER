import {
  MigrationInterface,
  QueryRunner,
} from 'typeorm';

const USER_PERMISSIONS_TABLE = 'user_permissions';
const AUDIT_TABLE = 'role_permission_audit';
const OWNERSHIP_MARKER = 'created-by:CreateRolePermissionTables1795300000000';

/** Tạo hoặc hoàn thiện schema quyền trực tiếp và audit mà không ghi đè bảng có sẵn. */
export class CreateRolePermissionTables1795300000000
  implements MigrationInterface
{
  async up(queryRunner: QueryRunner): Promise<void> {
    const createdUserPermissions = !(await queryRunner.hasTable(
      USER_PERMISSIONS_TABLE,
    ));
    const createdAudit = !(await queryRunner.hasTable(AUDIT_TABLE));

    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "${USER_PERMISSIONS_TABLE}" (
      "user_id" integer NOT NULL,
      "permission_id" integer NOT NULL,
      "granted_by_user_id" integer,
      "granted_at" timestamp NOT NULL DEFAULT now(),
      CONSTRAINT "PK_user_permissions" PRIMARY KEY ("user_id", "permission_id"),
      CONSTRAINT "FK_user_permissions_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
      CONSTRAINT "FK_user_permissions_permission" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE,
      CONSTRAINT "FK_user_permissions_grantor" FOREIGN KEY ("granted_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL
    )`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "${AUDIT_TABLE}" (
      "id" SERIAL PRIMARY KEY,
      "action" varchar(40) NOT NULL,
      "target_role_code" varchar(40),
      "target_user_id" integer,
      "actor_user_id" integer,
      "actor_snapshot" jsonb NOT NULL,
      "target_snapshot" jsonb NOT NULL,
      "before_permission_codes" jsonb NOT NULL,
      "after_permission_codes" jsonb NOT NULL,
      "created_at" timestamp NOT NULL DEFAULT now(),
      CONSTRAINT "FK_role_permission_audit_target" FOREIGN KEY ("target_user_id") REFERENCES "users"("id") ON DELETE SET NULL,
      CONSTRAINT "FK_role_permission_audit_actor" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL,
      CONSTRAINT "CHK_role_permission_audit_target" CHECK (
        ("action" = 'ROLE_PERMISSIONS_UPDATED' AND "target_role_code" IS NOT NULL AND "target_user_id" IS NULL)
        OR ("action" = 'USER_PERMISSIONS_UPDATED' AND "target_role_code" IS NULL)
      )
    )`);

    if (createdUserPermissions) {
      await queryRunner.query(
        `COMMENT ON TABLE "${USER_PERMISSIONS_TABLE}" IS '${OWNERSHIP_MARKER}'`,
      );
    }
    if (createdAudit) {
      await queryRunner.query(
        `COMMENT ON TABLE "${AUDIT_TABLE}" IS '${OWNERSHIP_MARKER}'`,
      );
    }

    // Một số môi trường đã có hai bảng từ lần chuẩn bị trước; hoàn thiện FK còn thiếu.
    await this.ensureForeignKey(
      queryRunner,
      USER_PERMISSIONS_TABLE,
      'user_id',
      'users',
      'FK_user_permissions_user',
      'CASCADE',
    );
    await this.ensureForeignKey(
      queryRunner,
      USER_PERMISSIONS_TABLE,
      'permission_id',
      'permissions',
      'FK_user_permissions_permission',
      'CASCADE',
    );
    await this.ensureForeignKey(
      queryRunner,
      USER_PERMISSIONS_TABLE,
      'granted_by_user_id',
      'users',
      'FK_user_permissions_grantor',
      'SET NULL',
    );
    await this.ensureForeignKey(
      queryRunner,
      AUDIT_TABLE,
      'target_user_id',
      'users',
      'FK_role_permission_audit_target',
      'SET NULL',
    );
    await this.ensureForeignKey(
      queryRunner,
      AUDIT_TABLE,
      'actor_user_id',
      'users',
      'FK_role_permission_audit_actor',
      'SET NULL',
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_user_permissions_permission_id" ON "${USER_PERMISSIONS_TABLE}" ("permission_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_role_permission_audit_created_at" ON "${AUDIT_TABLE}" ("created_at" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_role_permission_audit_target_user" ON "${AUDIT_TABLE}" ("target_user_id", "created_at" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_role_permission_audit_target_role" ON "${AUDIT_TABLE}" ("target_role_code", "created_at" DESC)`,
    );

    const audit = await queryRunner.getTable(AUDIT_TABLE);
    if (
      audit &&
      !audit.checks.some(
        (check) => check.name === 'CHK_role_permission_audit_target',
      )
    ) {
      // NOT VALID giữ nguyên các bản ghi audit cũ nhưng ràng buộc mọi bản ghi mới.
      await queryRunner.query(
        `ALTER TABLE "${AUDIT_TABLE}" ADD CONSTRAINT "CHK_role_permission_audit_target" CHECK (
          ("action" = 'ROLE_PERMISSIONS_UPDATED' AND "target_role_code" IS NOT NULL AND "target_user_id" IS NULL)
          OR ("action" = 'USER_PERMISSIONS_UPDATED' AND "target_role_code" IS NULL)
        ) NOT VALID`,
      );
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // Rollback hanya menghapus tabel kosong yang dibuat oleh migrasi ini;
    // tabel yang sudah ada sebelumnya dan histori yang sudah tercatat tetap dijaga.
    for (const tableName of [AUDIT_TABLE, USER_PERMISSIONS_TABLE]) {
      if (!(await queryRunner.hasTable(tableName))) continue;
      const [table] = await queryRunner.query(
        `SELECT obj_description($1::regclass, 'pg_class') AS comment`,
        [tableName],
      );
      if (table?.comment !== OWNERSHIP_MARKER) continue;

      const [{ has_rows: hasRows }] = await queryRunner.query(
        `SELECT EXISTS (SELECT 1 FROM "${tableName}" LIMIT 1) AS has_rows`,
      );
      if (hasRows) {
        throw new Error(
          `Không thể rollback ${tableName} vì bảng đã có dữ liệu; cần quy trình lưu trữ riêng.`,
        );
      }
    }

    for (const tableName of [AUDIT_TABLE, USER_PERMISSIONS_TABLE]) {
      if (!(await queryRunner.hasTable(tableName))) continue;
      const [table] = await queryRunner.query(
        `SELECT obj_description($1::regclass, 'pg_class') AS comment`,
        [tableName],
      );
      if (table?.comment === OWNERSHIP_MARKER) {
        await queryRunner.dropTable(tableName);
      }
    }
  }

  private async ensureForeignKey(
    queryRunner: QueryRunner,
    tableName: string,
    columnName: string,
    referencedTableName: string,
    constraintName: string,
    onDelete: string,
  ): Promise<void> {
    const table = await queryRunner.getTable(tableName);
    if (!table) return;
    const hasForeignKey = table.foreignKeys.some(
      (foreignKey) =>
        foreignKey.columnNames.length === 1 &&
        foreignKey.columnNames[0] === columnName &&
        foreignKey.referencedTableName.split('.').pop() ===
          referencedTableName &&
        foreignKey.onDelete?.toUpperCase() === onDelete,
    );
    if (hasForeignKey) return;

    // NOT VALID tránh làm hỏng migration vì FK mồ côi có thể đã tồn tại
    // trước khi bảng được quản lý bởi migration; thao tác mới vẫn được kiểm tra.
    await queryRunner.query(
      `ALTER TABLE "${tableName}" ADD CONSTRAINT "${constraintName}" ` +
        `FOREIGN KEY ("${columnName}") REFERENCES "${referencedTableName}"("id") ` +
        `ON DELETE ${onDelete} NOT VALID`,
    );
  }
}
