import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { PaymentsGateway } from './payments.gateway';

@Module({
  imports: [
    PrismaModule,
    ConfigModule, // ✅ หรือ ConfigModule.forRoot() ถ้าจำเป็น
    HttpModule.register({
      timeout: 15000,
      maxRedirects: 3,
    }),
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService, PaymentsGateway],
  exports: [PaymentsService, PaymentsGateway],
})
export class PaymentsModule {}
