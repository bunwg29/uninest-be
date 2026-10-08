import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User, Role, Permission, RolePermission } from './entities';
import { UsersService } from './users.service';
import { RolesService } from './roles.service';
import { UsersController } from './users.controller';
import { LandlordProfileController } from './landlord-profile.controller';
import { LandlordProfileService } from './landlord-profile.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Role, Permission, RolePermission]),
    forwardRef(() => AuthModule),
  ],
  controllers: [UsersController, LandlordProfileController],
  providers: [UsersService, RolesService, LandlordProfileService],
  exports: [UsersService, RolesService, TypeOrmModule],
})
export class UsersModule {}
