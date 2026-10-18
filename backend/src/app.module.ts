import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { CommonModule } from './common/common.module';
import { AuthModule } from './modules/auth/auth.module';
import { CompanyModule } from './modules/organization/company/company.module';
import { BranchModule } from './modules/organization/branch/branch.module';
import { FinancialYearModule } from './modules/organization/financial-year/financial-year.module';
import { DepartmentModule } from './modules/hr/department/department.module';
import { EmployeeModule } from './modules/hr/employee/employee.module';
import { RoleModule } from './modules/security/role/role.module';
import { UserModule } from './modules/security/user/user.module';
import { AuditLogViewerModule } from './modules/security/audit-log/audit-log-viewer.module';
import { SystemConfigModule } from './modules/admin/system-config/system-config.module';
import { WarehouseModule } from './modules/inventory/warehouse/warehouse.module';
import { UomModule } from './modules/inventory/uom/uom.module';
import { ItemModule } from './modules/inventory/item/item.module';
import { PartyModule } from './modules/parties/party/party.module';
import { PriceListModule } from './modules/parties/price-list/price-list.module';
import { RequisitionModule } from './modules/procurement/requisition/requisition.module';
import { RfqModule } from './modules/procurement/rfq/rfq.module';
import { PurchaseOrderModule } from './modules/procurement/purchase-order/purchase-order.module';
import { GateInwardModule } from './modules/procurement/gate-inward/gate-inward.module';
import { GrnModule } from './modules/procurement/grn/grn.module';
import { InwardQcModule } from './modules/quality/inward-qc/inward-qc.module';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { AuditLogInterceptor } from './common/interceptors/audit-log.interceptor';
import { ResponseEnvelopeInterceptor } from './common/interceptors/response-envelope.interceptor';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
    }),
    DatabaseModule,
    CommonModule,
    AuthModule,
    CompanyModule,
    BranchModule,
    FinancialYearModule,
    DepartmentModule,
    EmployeeModule,
    RoleModule,
    UserModule,
    AuditLogViewerModule,
    SystemConfigModule,
    WarehouseModule,
    UomModule,
    ItemModule,
    PartyModule,
    PriceListModule,
    RequisitionModule,
    RfqModule,
    PurchaseOrderModule,
    GateInwardModule,
    GrnModule,
    InwardQcModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditLogInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseEnvelopeInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
