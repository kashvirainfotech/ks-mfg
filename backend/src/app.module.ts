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
import { PutAwayModule } from './modules/inventory/put-away/put-away.module';
import { InvoiceModule } from './modules/procurement/invoice/invoice.module';
import { BomModule } from './modules/manufacturing/bom/bom.module';
import { WorkCenterModule } from './modules/manufacturing/work-center/work-center.module';
import { RoutingModule } from './modules/manufacturing/routing/routing.module';
import { MrpModule } from './modules/manufacturing/mrp/mrp.module';
import { WorkOrderModule } from './modules/manufacturing/work-order/work-order.module';
import { MaterialIssueModule } from './modules/manufacturing/material-issue/material-issue.module';
import { JobCardModule } from './modules/manufacturing/job-card/job-card.module';
import { JobWorkModule } from './modules/manufacturing/job-work/job-work.module';
import { FgReceiptModule } from './modules/manufacturing/fg-receipt/fg-receipt.module';
import { QuotationModule } from './modules/sales/quotation/quotation.module';
import { OrderModule } from './modules/sales/order/order.module';
import { DeliveryChallanModule } from './modules/sales/delivery-challan/challan.module';
import { SalesInvoiceModule } from './modules/sales/invoice/invoice.module';
import { SalesReturnModule } from './modules/sales/return/return.module';
import { StockBalanceModule } from './modules/inventory/balance/stock-balance.module';
import { StockAdjustmentModule } from './modules/inventory/adjustment/adjustment.module';
import { StockTransferModule } from './modules/inventory/transfer/transfer.module';
import { StockTraceabilityModule } from './modules/inventory/traceability/traceability.module';
import { StockAgingModule } from './modules/inventory/aging/aging.module';
import { InProcessQcModule } from './modules/quality/in-process-qc/in-process-qc.module';
import { PdiModule } from './modules/quality/pdi/pdi.module';
import { NcrModule } from './modules/quality/ncr/ncr.module';
import { CalibrationModule } from './modules/quality/calibration/calibration.module';
import { GlModule } from './modules/accounts/gl/gl.module';
import { BankingModule } from './modules/accounts/banking/banking.module';
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
    PutAwayModule,
    InvoiceModule,
    BomModule,
    WorkCenterModule,
    RoutingModule,
    MrpModule,
    WorkOrderModule,
    MaterialIssueModule,
    JobCardModule,
    JobWorkModule,
    FgReceiptModule,
    QuotationModule,
    OrderModule,
    DeliveryChallanModule,
    SalesInvoiceModule,
    SalesReturnModule,
    StockBalanceModule,
    StockAdjustmentModule,
    StockTransferModule,
    StockTraceabilityModule,
    StockAgingModule,
    InProcessQcModule,
    PdiModule,
    NcrModule,
    CalibrationModule,
    GlModule,
    BankingModule,
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
