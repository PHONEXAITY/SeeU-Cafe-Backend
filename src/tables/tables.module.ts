import { Module } from '@nestjs/common';
import { TablesService } from './tables.service';
import { TablesController } from './tables.controller';
import { TableCleanupService } from './services/table-cleanup.service';
import { PrismaModule } from '../prisma/prisma.module';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [PrismaModule, HttpModule],
  controllers: [TablesController],
  providers: [TablesService, TableCleanupService],
  exports: [TablesService, TableCleanupService],
})
export class TablesModule {}
