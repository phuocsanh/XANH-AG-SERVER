import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Permission } from '../../entities/permission.entity';
import { Role } from '../../entities/role.entity';
import { RolePermissionAudit } from '../../entities/role-permission-audit.entity';
import { User } from '../../entities/users.entity';
import { UserPermission } from '../../entities/user-permission.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SuperAdminGuard } from '../../common/guards/super-admin.guard';
import { RolePermissionController } from './role-permission.controller';
import { RolePermissionService } from './role-permission.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, Role, Permission, UserPermission, RolePermissionAudit])],
  controllers: [RolePermissionController],
  providers: [RolePermissionService, JwtAuthGuard, SuperAdminGuard],
})
export class RolePermissionModule {}
