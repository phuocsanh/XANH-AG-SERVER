import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUniqueConstraintToUserAccount1762057893225
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // First, delete duplicate accounts keeping only the latest one
    await queryRunner.query(`
            DELETE FROM users 
            WHERE id NOT IN (
                SELECT MAX(id) 
                FROM users 
                GROUP BY account
            )
        `);

    // Then add unique constraint to account column
    await queryRunner.query(
      `ALTER TABLE users ADD CONSTRAINT unique_account UNIQUE (account)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE users DROP CONSTRAINT unique_account`);
  }
}
