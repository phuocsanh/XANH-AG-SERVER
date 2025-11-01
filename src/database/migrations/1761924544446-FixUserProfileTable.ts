import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixUserProfileTable1761924544446 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop the existing user_profiles table if it exists
    await queryRunner.query(`DROP TABLE IF EXISTS "user_profiles"`);

    // Create the user_profiles table with the correct schema
    await queryRunner.query(`
            CREATE TABLE "user_profiles" (
                "user_id" integer NOT NULL,
                "account" character varying NOT NULL,
                "nickname" character varying,
                "avatar" character varying,
                "status" character varying NOT NULL DEFAULT 'active',
                "mobile" character varying,
                "gender" integer,
                "birthday" TIMESTAMP,
                "email" character varying,
                "is_authentication" integer NOT NULL,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                "deleted_at" TIMESTAMP,
                CONSTRAINT "PK_user_profiles_user_id" PRIMARY KEY ("user_id")
            )
        `);

    // Add foreign key constraint to users table
    await queryRunner.query(`
            ALTER TABLE "user_profiles" 
            ADD CONSTRAINT "FK_user_profiles_user_id" 
            FOREIGN KEY ("user_id") REFERENCES "users"("id") 
            ON DELETE CASCADE
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop the foreign key constraint
    await queryRunner.query(
      `ALTER TABLE "user_profiles" DROP CONSTRAINT "FK_user_profiles_user_id"`,
    );

    // Drop the user_profiles table
    await queryRunner.query(`DROP TABLE "user_profiles"`);
  }
}
