// src/tables/services/table-cleanup.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';

@Injectable()
export class TableCleanupService {
  private readonly logger = new Logger(TableCleanupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {}

  // รันทุกๆ 30 นาที เพื่อตรวจสอบโต๊ะที่ควรจะถูกปล่อย
  @Cron('*/30 * * * *') // ทุกๆ 30 นาที
  async checkOccupiedTables() {
    this.logger.log('🔍 Checking occupied tables for cleanup...');

    try {
      const now = new Date();
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

      // หาโต๊ะที่นั่งเกิน 2 ชั่วโมงแล้ว และไม่มี order ที่ active
      const occupiedTables = await this.prisma.table.findMany({
        where: {
          status: 'occupied',
          current_session_start: {
            lte: twoHoursAgo,
          },
        },
        include: {
          orders: {
            where: {
              status: {
                in: ['pending', 'preparing', 'ready', 'served'],
              },
            },
          },
        },
      });

      let tablesReleased = 0;
      for (const table of occupiedTables) {
        // ถ้าไม่มี active orders แล้ว ให้ปล่อยโต๊ะ
        if (table.orders.length === 0) {
          await this.releaseTable(table.id, 'Auto cleanup - no active orders');
          tablesReleased++;
        }
      }

      this.logger.log(`✅ Cleanup completed. Released ${tablesReleased} tables.`);

      // ส่งข้อมูลโต๊ะไปยัง n8n สำหรับ monitoring
      await this.sendTableStatusToN8n();

    } catch (error) {
      this.logger.error('Error during table cleanup check:', error);
    }
  }

  // รันทุกๆ วันเที่ยงคืน เพื่อส่งรายงานการใช้โต๊ะ
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async sendDailyTableReport() {
    this.logger.log('📊 Generating daily table usage report...');

    try {
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

      // ดึงข้อมูลการใช้โต๊ะในวันนี้
      const tableUsage = await this.prisma.order.groupBy({
        by: ['table_id'],
        where: {
          table_id: { not: null },
          create_at: {
            gte: startOfDay,
            lt: endOfDay,
          },
          status: {
            in: ['completed', 'delivered'],
          },
        },
        _count: {
          id: true,
        },
        _sum: {
          total_price: true,
        },
      });

      // รวมข้อมูลกับโต๊ะ
      const tableReports = await Promise.all(
        tableUsage.map(async (usage) => {
          if (!usage.table_id) return null;
          
          const table = await this.prisma.table.findUnique({
            where: { id: usage.table_id },
          });

          return {
            tableNumber: table?.number,
            tableId: usage.table_id,
            ordersCount: usage._count.id,
            totalRevenue: usage._sum.total_price || 0,
          };
        }),
      );

      const validTableReports = tableReports.filter(report => report !== null);

      // ส่งรายงานไปยัง n8n
      const tableWebhookUrl = this.configService.get<string>('N8N_TABLE_WEBHOOK_URL');
      
      if (tableWebhookUrl && validTableReports.length > 0) {
        const payload = {
          reportType: 'daily_table_usage',
          date: startOfDay.toISOString(),
          tables: validTableReports,
          totalRevenue: validTableReports.reduce((sum, report) => sum + report.totalRevenue, 0),
          totalOrders: validTableReports.reduce((sum, report) => sum + report.ordersCount, 0),
          timestamp: new Date().toISOString(),
        };

        await this.httpService.axiosRef.post(tableWebhookUrl, payload, {
          timeout: 10000,
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Source': 'seeu-cafe-table-service',
          },
        });

        this.logger.log('✅ Daily table report sent to n8n');
      }

    } catch (error) {
      this.logger.error('Error generating daily table report:', error);
    }
  }

  // รันทุกเที่ยงเพื่อตรวจสอบโต๊ะที่ใช้งานหนัก
  @Cron('0 12 * * *') // ทุกวันเที่ยง
  async checkHighUsageTables() {
    this.logger.log('📈 Checking high usage tables...');

    try {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      // หาโต๊ะที่มี order มากกว่า 10 ครั้งในวันนี้
      const highUsageTables = await this.prisma.order.groupBy({
        by: ['table_id'],
        where: {
          table_id: { not: null },
          create_at: {
            gte: startOfDay,
          },
        },
        _count: {
          id: true,
        },
        having: {
          id: {
            _count: {
              gt: 10,
            },
          },
        },
      });

      if (highUsageTables.length > 0) {
        const tableDetails = await Promise.all(
          highUsageTables.map(async (usage) => {
            if (!usage.table_id) return null;
            
            const table = await this.prisma.table.findUnique({
              where: { id: usage.table_id },
            });

            return {
              tableNumber: table?.number,
              tableId: usage.table_id,
              usageCount: usage._count.id,
            };
          }),
        );

        const validTableDetails = tableDetails.filter(detail => detail !== null);

        // ส่งแจ้งเตือนไปยัง n8n
        const tableWebhookUrl = this.configService.get<string>('N8N_TABLE_WEBHOOK_URL');
        
        if (tableWebhookUrl && validTableDetails.length > 0) {
          const payload = {
            reportType: 'high_usage_alert',
            date: startOfDay.toISOString(),
            highUsageTables: validTableDetails,
            message: 'Some tables need attention due to high usage',
            timestamp: new Date().toISOString(),
          };

          await this.httpService.axiosRef.post(tableWebhookUrl, payload, {
            timeout: 10000,
            headers: {
              'Content-Type': 'application/json',
              'X-Webhook-Source': 'seeu-cafe-table-service',
            },
          });

          this.logger.log(`⚠️ High usage alert sent for ${validTableDetails.length} tables`);
        }
      }

    } catch (error) {
      this.logger.error('Error checking high usage tables:', error);
    }
  }

  private async releaseTable(tableId: number, reason: string) {
    try {
      const table = await this.prisma.table.update({
        where: { id: tableId },
        data: {
          status: 'available',
          current_session_start: null,
          expected_end_time: null,
        },
      });

      this.logger.log(`🏠 Table #${table.number} released automatically: ${reason}`);

      // ส่งการแจ้งเตือนไปยัง n8n
      const tableWebhookUrl = this.configService.get<string>('N8N_TABLE_WEBHOOK_URL');
      
      if (tableWebhookUrl) {
        const payload = {
          tableId: tableId,
          tableNumber: table.number,
          currentStatus: 'occupied',
          newStatus: 'available',
          reason: reason,
          timestamp: new Date().toISOString(),
          automated: true,
        };

        await this.httpService.axiosRef.post(tableWebhookUrl, payload, {
          timeout: 5000,
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Source': 'seeu-cafe-table-service',
          },
        });
      }

      return table;

    } catch (error) {
      this.logger.error(`Error releasing table ${tableId}:`, error);
      throw error;
    }
  }

  private async sendTableStatusToN8n() {
    try {
      const tableWebhookUrl = this.configService.get<string>('N8N_TABLE_WEBHOOK_URL');
      
      if (!tableWebhookUrl) {
        return;
      }

      // ดึงสถานะโต๊ะทั้งหมด
      const allTables = await this.prisma.table.findMany({
        include: {
          orders: {
            where: {
              status: {
                in: ['pending', 'preparing', 'ready', 'served'],
              },
            },
          },
        },
      });

      const tableStatus = allTables.map(table => ({
        id: table.id,
        number: table.number,
        status: table.status,
        capacity: table.capacity,
        currentSessionStart: table.current_session_start,
        expectedEndTime: table.expected_end_time,
        activeOrdersCount: table.orders.length,
        sessionDuration: table.current_session_start ? 
          Math.floor((new Date().getTime() - table.current_session_start.getTime()) / (1000 * 60)) : 0, // minutes
      }));

      const payload = {
        reportType: 'table_status_update',
        tables: tableStatus,
        summary: {
          total: allTables.length,
          available: allTables.filter(t => t.status === 'available').length,
          occupied: allTables.filter(t => t.status === 'occupied').length,
          maintenance: allTables.filter(t => t.status === 'maintenance').length,
        },
        timestamp: new Date().toISOString(),
      };

      await this.httpService.axiosRef.post(tableWebhookUrl, payload, {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Source': 'seeu-cafe-table-service',
        },
      });

    } catch (error) {
      this.logger.error('Error sending table status to n8n:', error);
    }
  }

  // Manual method สำหรับ trigger cleanup
  async triggerManualCleanup() {
    this.logger.log('🔧 Manual table cleanup triggered...');
    
    try {
      await this.checkOccupiedTables();
      return {
        success: true,
        message: 'Manual cleanup completed successfully',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Manual cleanup failed:', error);
      return {
        success: false,
        message: 'Manual cleanup failed',
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  // Method สำหรับดูสถานะโต๊ะ
  async getTableStatus() {
    const allTables = await this.prisma.table.findMany({
      include: {
        orders: {
          where: {
            status: {
              in: ['pending', 'preparing', 'ready', 'served'],
            },
          },
        },
      },
    });

    return allTables.map(table => ({
      id: table.id,
      number: table.number,
      status: table.status,
      capacity: table.capacity,
      currentSessionStart: table.current_session_start,
      expectedEndTime: table.expected_end_time,
      activeOrdersCount: table.orders.length,
      sessionDuration: table.current_session_start ? 
        Math.floor((new Date().getTime() - table.current_session_start.getTime()) / (1000 * 60)) : 0,
      needsCleanup: table.status === 'occupied' && 
        table.current_session_start && 
        table.orders.length === 0 &&
        (new Date().getTime() - table.current_session_start.getTime()) > (2 * 60 * 60 * 1000), // 2 hours
    }));
  }

  // Method สำหรับดูสถิติการใช้งานโต๊ะ
  async getTableStatistics(days: number = 7) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const tableUsage = await this.prisma.order.groupBy({
      by: ['table_id'],
      where: {
        table_id: { not: null },
        create_at: {
          gte: startDate,
        },
        status: {
          in: ['completed', 'delivered'],
        },
      },
      _count: {
        id: true,
      },
      _sum: {
        total_price: true,
      },
      _avg: {
        total_price: true,
      },
    });

    const tableStats = await Promise.all(
      tableUsage.map(async (usage) => {
        if (!usage.table_id) return null;
        
        const table = await this.prisma.table.findUnique({
          where: { id: usage.table_id },
        });

        // คำนวณ utilization rate
        const totalPossibleHours = days * 14; // สมมติเปิด 14 ชั่วโมงต่อวัน
        const averageOrderDuration = 1.5; // สมมติ 1.5 ชั่วโมงต่อ order
        const actualUsageHours = usage._count.id * averageOrderDuration;
        const utilizationRate = Math.round((actualUsageHours / totalPossibleHours) * 100);

        return {
          tableId: usage.table_id,
          tableNumber: table?.number,
          ordersCount: usage._count.id,
          totalRevenue: usage._sum.total_price || 0,
          averageOrderValue: usage._avg.total_price || 0,
          utilizationRate,
          revenuePerHour: totalPossibleHours > 0 ? (usage._sum.total_price || 0) / totalPossibleHours : 0,
        };
      }),
    );

    return {
      period: `Last ${days} days`,
      startDate: startDate.toISOString(),
      endDate: new Date().toISOString(),
      tables: tableStats.filter(stat => stat !== null),
      summary: {
        totalOrders: tableUsage.reduce((sum, usage) => sum + usage._count.id, 0),
        totalRevenue: tableUsage.reduce((sum, usage) => sum + (usage._sum.total_price || 0), 0),
        averageUtilization: tableStats.filter(s => s !== null).reduce((avg, stat, _, arr) => 
          avg + (stat?.utilizationRate || 0) / arr.length, 0),
      },
    };
  }

  // Method สำหรับส่งรายงานฉุกเฉิน
  async sendEmergencyAlert(message: string, tables?: number[]) {
    try {
      const tableWebhookUrl = this.configService.get<string>('N8N_TABLE_WEBHOOK_URL');
      
      if (!tableWebhookUrl) {
        this.logger.warn('Table webhook URL not configured');
        return;
      }

      const payload = {
        reportType: 'emergency_alert',
        message,
        tables: tables || [],
        timestamp: new Date().toISOString(),
        severity: 'high',
      };

      await this.httpService.axiosRef.post(tableWebhookUrl, payload, {
        timeout: 5000,
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Source': 'seeu-cafe-table-service',
        },
      });

      this.logger.log(`🚨 Emergency alert sent: ${message}`);

    } catch (error) {
      this.logger.error('Failed to send emergency alert:', error);
    }
  }
}