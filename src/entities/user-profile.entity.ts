import { Entity, Column, PrimaryColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('user_profiles')
export class UserProfile {
  @PrimaryColumn({ name: 'user_id' })
  userId: number;

  @Column({ name: 'user_account' })
  userAccount: string;

  @Column({ name: 'user_nickname', nullable: true })
  userNickname: string;

  @Column({ name: 'user_avatar', nullable: true })
  userAvatar: string;

  @Column({ name: 'user_state' })
  userState: number;

  @Column({ name: 'user_mobile', nullable: true })
  userMobile: string;

  @Column({ name: 'user_gender', nullable: true })
  userGender: number;

  @Column({ name: 'user_birthday', nullable: true })
  userBirthday: Date;

  @Column({ name: 'user_email', nullable: true })
  userEmail: string;

  @Column({ name: 'user_is_authentication' })
  userIsAuthentication: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}