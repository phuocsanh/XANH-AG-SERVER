import {
  Controller,
  Body,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { User } from '../../entities/users.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SuperAdminGuard } from '../../common/guards/super-admin.guard';
import { AuditQueryDto } from './dto/audit-query.dto';
import { UpdatePermissionsDto } from './dto/update-permissions.dto';
import { UserSearchQueryDto } from './dto/user-search-query.dto';
import { RolePermissionService } from './role-permission.service';

type AuthenticatedRequest = Request & { user: User };

/** API tập trung quản lý role permissions và quyền cấp riêng cho user. */
@Controller('role-permissions')
@UseGuards(JwtAuthGuard, SuperAdminGuard)
export class RolePermissionController {
  constructor(private readonly rolePermissionService: RolePermissionService) {}

  @Get('permissions')
  getCatalog() {
    return this.rolePermissionService.getCatalog();
  }

  @Get('roles')
  getRoles() {
    return this.rolePermissionService.getRoles();
  }

  @Get('users/search')
  searchUsers(@Query() query: UserSearchQueryDto) {
    return this.rolePermissionService.searchUsers(query);
  }

  @Put('roles/:id')
  updateRole(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: AuthenticatedRequest,
    @Body() body: UpdatePermissionsDto,
  ) {
    return this.rolePermissionService.updateRolePermissions(id, body, request.user);
  }

  @Get('users/:id')
  getUserPermissions(@Param('id', ParseIntPipe) id: number) {
    return this.rolePermissionService.getUserPermissions(id);
  }

  @Put('users/:id')
  updateUserPermissions(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: AuthenticatedRequest,
    @Body() body: UpdatePermissionsDto,
  ) {
    return this.rolePermissionService.updateUserPermissions(id, body, request.user);
  }

  @Delete('users/:id')
  resetUserPermissions(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.rolePermissionService.resetUserPermissions(id, request.user);
  }

  @Get('audit')
  getAuditHistory(@Query() query: AuditQueryDto) {
    return this.rolePermissionService.getAuditHistory(query);
  }
}
