import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DependencyCheckService } from './services/dependency-check.service';
import { RedisService } from './services/redis.service';
import { AuditLogService } from './services/audit-log.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { AuditLogInterceptor } from './interceptors/audit-log.interceptor';

@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret:
          configService.get<string>('JWT_ACCESS_SECRET') ||
          'ks-mfg-erp-super-secret-access-key-2026',
        signOptions: {
          expiresIn: (configService.get<string>('JWT_ACCESS_EXPIRES_IN') ||
            '15m') as any,
        },
      }),
    }),
  ],
  providers: [
    DependencyCheckService,
    RedisService,
    AuditLogService,
    JwtAuthGuard,
    PermissionsGuard,
    AuditLogInterceptor,
  ],
  exports: [
    JwtModule,
    DependencyCheckService,
    RedisService,
    AuditLogService,
    JwtAuthGuard,
    PermissionsGuard,
    AuditLogInterceptor,
  ],
})
export class CommonModule {}
