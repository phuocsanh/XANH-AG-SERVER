import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn({ name: 'user_id' })
  userId: number;

  @Column({ name: 'user_account' })
  userAccount: string;

  @Column({ name: 'user_password' })
  userPassword: string;

  @Column({ name: 'user_salt' })
  userSalt: string;

  @Column({ name: 'user_login_time', nullable: true })
  userLoginTime: Date;

  @Column({ name: 'user_logout_time', nullable: true })
  userLogoutTime: Date;

  @Column({ name: 'user_login_ip', nullable: true })
  userLoginIp: string;

  @CreateDateColumn({ name: 'user_created_at' })
  userCreatedAt: Date;

  @UpdateDateColumn({ name: 'user_updated_at' })
  userUpdatedAt: Date;

  @Column({ name: 'is_two_factor_enabled', nullable: true })
  isTwoFactorEnabled: boolean;
}