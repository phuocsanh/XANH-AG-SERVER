import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration tạo bảng locations và rice_blast_warnings
 * Cho hệ thống cảnh báo bệnh đạo ôn lúa
 */
export class CreateRiceBlastWarningTables1732867200000 implements MigrationInterface {
  name = 'CreateRiceBlastWarningTables1732867200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Tạo bảng locations
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS locations (
        id BIGINT PRIMARY KEY DEFAULT 1,
        name TEXT NOT NULL,
        lat DOUBLE PRECISION NOT NULL,
        lon DOUBLE PRECISION NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT single_location_check CHECK (id = 1)
      )
    `);

    // Thêm comment cho bảng locations
    await queryRunner.query(`
      COMMENT ON TABLE locations IS 'Bảng lưu vị trí ruộng lúa (chỉ 1 dòng duy nhất)'
    `);

    // Thêm dữ liệu mặc định cho locations
    await queryRunner.query(`
      INSERT INTO locations (id, name, lat, lon, updated_at)
      VALUES (1, 'Ruộng nhà ông Tư - Tân Lập, Vũ Thư', 20.4167, 106.3667, NOW())
      ON CONFLICT (id) DO NOTHING
    `);

    // Tạo bảng rice_blast_warnings
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS rice_blast_warnings (
        id BIGINT PRIMARY KEY DEFAULT 1,
        generated_at TIMESTAMPTZ NOT NULL,
        risk_level TEXT NOT NULL,
        probability INTEGER NOT NULL CHECK (probability >= 0 AND probability <= 100),
        message TEXT NOT NULL,
        peak_days TEXT,
        daily_data JSONB NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT single_warning_check CHECK (id = 1)
      )
    `);

    // Thêm comment cho bảng rice_blast_warnings
    await queryRunner.query(`
      COMMENT ON TABLE rice_blast_warnings IS 'Bảng lưu cảnh báo bệnh đạo ôn mới nhất (chỉ 1 dòng duy nhất)'
    `);

    // Thêm indexes
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_warnings_generated_at ON rice_blast_warnings(generated_at DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_warnings_risk_level ON rice_blast_warnings(risk_level)
    `);

    // Thêm dữ liệu mặc định cho rice_blast_warnings
    await queryRunner.query(`
      INSERT INTO rice_blast_warnings (id, generated_at, risk_level, probability, message, peak_days, daily_data, updated_at)
      VALUES (
        1,
        NOW(),
        'ĐANG CHỜ CẬP NHẬT',
        0,
        'Hệ thống đang khởi động. Vui lòng chờ phân tích tự động hoặc bấm "Chạy ngay" để cập nhật.',
        NULL,
        '[]'::jsonb,
        NOW()
      )
      ON CONFLICT (id) DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(`DROP INDEX IF EXISTS idx_warnings_risk_level`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_warnings_generated_at`);

    // Drop tables
    await queryRunner.query(`DROP TABLE IF EXISTS rice_blast_warnings`);
    await queryRunner.query(`DROP TABLE IF EXISTS locations`);
  }
}
