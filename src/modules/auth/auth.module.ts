import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersModule } from '../users/users.module';
import { LocationsModule } from '../locations/locations.module';
import { RefreshToken, OtpCode } from './entities';
import { AuthService, OtpService, TokenService } from './services';
import { JwtStrategy } from './strategies/jwt.strategy';
import { AuthController } from './auth.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([RefreshToken, OtpCode]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>(
          'JWT_ACCESS_SECRET',
          'uninest_dev_access_secret_key_32bytes!',
        ),
        signOptions: {
          expiresIn: 900,
        },
      }),
    }),
    forwardRef(() => UsersModule),
    LocationsModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, OtpService, TokenService, JwtStrategy],
  exports: [AuthService, OtpService, TokenService, PassportModule, JwtModule],
})
export class AuthModule {}
