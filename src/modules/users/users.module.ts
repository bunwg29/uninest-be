import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User, Role, Permission, RolePermission } from './entities';
import { UsersService } from './users.service';
import { RolesService } from './roles.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, Role, Permission, RolePermission])],
  controllers: [],
  providers: [UsersService, RolesService],
  exports: [UsersService, RolesService, TypeOrmModule],
})
export class UsersModule {}
