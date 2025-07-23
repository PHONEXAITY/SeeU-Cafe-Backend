import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Query,
  Delete,
} from '@nestjs/common';
import { CombinedBillService } from '../services/combined-bill.service';
import { CreateCombinedBillDto } from '../dto/create-combined-bill.dto';
import { SplitBillDto } from '../dto/split-bill.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';

@ApiTags('Combined Bills - ระบบรวมบิลหลายโต๊ะ')
@Controller('combined-bills')
export class CombinedBillController {
  constructor(private readonly combinedBillService: CombinedBillService) {}

  // =============== EXISTING ENDPOINTS ===============

  @Get('tables/available')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'ดูโต๊ะที่มีออเดอร์ยังไม่ได้ชำระ (สำหรับสร้างบิลรวม)',
    description:
      'แสดงรายการโต๊ะที่มีออเดอร์สถานะ ready/completed/served ที่ยังไม่ได้ชำระเงิน',
  })
  @ApiResponse({
    status: 200,
    description: 'รายการโต๊ะที่สามารถรวมบิลได้',
    schema: {
      example: [
        {
          table_id: 1,
          table_number: 5,
          capacity: 4,
          total_orders: 2,
          total_amount: 850,
          session_duration: 45,
          orders: [
            {
              id: 1,
              order_id: 'ORD1234567890',
              total_price: 350,
              status: 'completed',
              customer_info: {
                name: 'สมชาย ใจดี',
                phone: '020-1234567',
              },
              items_count: 3,
              items: [
                {
                  id: 1,
                  name: 'ข้าวผัดไก่',
                  category: 'อาหารจานหลัก',
                  quantity: 1,
                  unit_price: 120,
                  total_price: 120,
                  type: 'food',
                  is_ready: true,
                },
              ],
              payment_status: {
                total_paid: 0,
                remaining_amount: 350,
                has_payments: false,
                payments: [],
              },
              created_at: '2023-01-01T12:00:00Z',
            },
          ],
        },
      ],
    },
  })
  async getTablesWithUnpaidOrders() {
    return this.combinedBillService.getTablesWithUnpaidOrders();
  }

  @Get('preview')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'ดูตัวอย่างบิลรวมก่อนสร้าง',
    description: 'แสดงรายละเอียดและยอดรวมของบิลก่อนสร้างจริง',
  })
  @ApiQuery({
    name: 'table_ids',
    description: 'รายการ ID โต๊ะที่ต้องการรวมบิล (คั่นด้วยเครื่องหมายจุลภาค)',
    example: '1,2,3',
  })
  @ApiResponse({
    status: 200,
    description: 'ตัวอย่างบิลรวม',
    schema: {
      example: {
        preview_id: 'PREVIEW_1640995200000',
        tables_count: 3,
        subtotal: 1250,
        total_discount: 50,
        net_amount: 1200,
        service_charge: 125,
        service_charge_rate: 0.1,
        final_amount: 1375,
        suggested_split_amount: 458.33,
        table_details: [
          {
            table_id: 1,
            table_number: 5,
            table_subtotal: 450,
            table_discount: 20,
            table_net_total: 430,
            orders_count: 2,
            order_ids: [1, 2],
            orders: [],
          },
        ],
        summary: {
          total_orders: 5,
          total_items: 12,
          average_per_table: 458.33,
          payment_methods_suggested: ['cash', 'card', 'transfer'],
        },
        created_at: '2023-01-01T12:00:00Z',
      },
    },
  })
  async previewCombinedBill(@Query('table_ids') tableIds: string) {
    const tableIdArray = tableIds.split(',').map((id) => parseInt(id));
    return this.combinedBillService.previewCombinedBill(tableIdArray);
  }

  @Post('create')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'staff', 'manager')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'สร้างบิลรวมสำหรับหลายโต๊ะ',
    description: 'สร้างบิลรวมจากโต๊ะที่เลือก พร้อมคำนวณค่าบริการ',
  })
  @ApiResponse({
    status: 201,
    description: 'สร้างบิลรวมสำเร็จ',
    schema: {
      example: {
        success: true,
        message: 'ສ້າງບິນລວມສຳເລັດ',
        combined_bill: {
          id: 1,
          bill_id: 'CB1640995200000123',
          subtotal: 1250,
          service_charge: 125,
          final_amount: 1375,
          status: 'pending_payment',
          customer_name: 'ລູກຄ້າກຸ່ມ A',
          notes: 'ບິນລວມສຳລັບງານລ້ຽງ',
          created_at: '2023-01-01T12:00:00Z',
        },
        tables_included: [
          {
            table_number: 5,
            subtotal: 450,
            orders_count: 2,
          },
          {
            table_number: 8,
            subtotal: 800,
            orders_count: 3,
          },
        ],
        payment_info: {
          amount_to_pay: 1375,
          suggested_method: 'cash',
          can_split: true,
        },
      },
    },
  })
  async createCombinedBill(
    @Body() createCombinedBillDto: CreateCombinedBillDto,
  ) {
    return this.combinedBillService.createCombinedBill(createCombinedBillDto);
  }

  @Post(':billId/pay')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'ชำระบิลรวมแบบเต็มจำนวน',
    description: 'ชำระบิลรวมทั้งหมดในครั้งเดียว พร้อมปล่อยโต๊ะทั้งหมด',
  })
  @ApiParam({
    name: 'billId',
    description: 'ID ของบิลรวม',
    example: 1,
  })
  @ApiResponse({
    status: 201,
    description: 'ชำระบิลรวมสำเร็จ',
    schema: {
      example: {
        success: true,
        message: 'ຊຳລະບິນລວມສຳເລັດ',
        payment: {
          id: 1,
          amount: 1375,
          method: 'cash',
          paid_at: '2023-01-01T12:30:00Z',
          notes: 'ຊຳລະເຕັມຈຳນວນ',
        },
        bill: {
          bill_id: 'CB1640995200000123',
          final_amount: 1375,
          status: 'paid',
        },
        tables_released: [
          {
            table_number: 5,
            orders_completed: 2,
          },
          {
            table_number: 8,
            orders_completed: 3,
          },
        ],
      },
    },
  })
  async payCombinedBill(
    @Param('billId') billId: string,
    @Body('payment_method') paymentMethod?: string,
    @Body('notes') notes?: string,
  ) {
    return this.combinedBillService.payCombinedBill(
      +billId,
      paymentMethod,
      notes,
    );
  }

  @Post(':billId/split-pay')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'ชำระบิลรวมแบบแบ่งจ่าย',
    description: 'ชำระบิลรวมโดยแบ่งตามโต๊ะหรือตามที่ต้องการ',
  })
  @ApiParam({
    name: 'billId',
    description: 'ID ของบิลรวม',
    example: 1,
  })
  @ApiResponse({
    status: 201,
    description: 'แบ่งจ่ายบิลรวมสำเร็จ',
    schema: {
      example: {
        success: true,
        message: 'ແບ່ງຈ່າຍບິນລວມສຳເລັດ',
        total_amount: 1375,
        split_payments: [
          {
            payment_id: 1,
            amount: 500,
            method: 'cash',
            table_reference: 'ແບ່ງຈ່າຍໂຕະ 1',
          },
          {
            payment_id: 2,
            amount: 875,
            method: 'card',
            table_reference: 'ແບ່ງຈ່າຍໂຕະ 2',
          },
        ],
        tables_processed: 2,
        paid_at: '2023-01-01T12:30:00Z',
      },
    },
  })
  async splitPayCombinedBill(
    @Param('billId') billId: string,
    @Body() splitBillDto: SplitBillDto,
  ) {
    return this.combinedBillService.splitPayCombinedBill(+billId, splitBillDto);
  }

  @Get(':billId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'ดูรายละเอียดบิลรวม',
    description: 'แสดงรายละเอียดบิลรวม รวมถึงโต๊ะ ออเดอร์ และการชำระเงิน',
  })
  @ApiParam({
    name: 'billId',
    description: 'ID ของบิลรวม',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'รายละเอียดบิลรวม',
    schema: {
      example: {
        id: 1,
        bill_id: 'CB1640995200000123',
        status: 'completed',
        total_amount: 1375,
        notes: 'Combined bill for tables: 5, 8',
        created_at: '2023-01-01T12:00:00Z',
        table_details: [
          {
            table_id: 1,
            table_number: 5,
            subtotal: 500,
            orders_count: 2,
            orders: [],
          },
        ],
        payments: [
          {
            id: 1,
            amount: 1375,
            method: 'cash',
            paid_at: '2023-01-01T12:30:00Z',
            status: 'completed',
          },
        ],
        summary: {
          tables_count: 2,
          total_payments: 1,
          is_split_payment: false,
          payment_status: 'completed',
          total_orders: 5,
          total_items: 12,
        },
      },
    },
  })
  async getCombinedBill(@Param('billId') billId: string) {
    return this.combinedBillService.getCombinedBill(+billId);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'ดูรายการบิลรวมทั้งหมด',
    description: 'แสดงรายการบิลรวมพร้อมกรองตามสถานะ',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'กรองตามสถานะ (pending_payment, completed, cancelled)',
    example: 'pending_payment',
  })
  @ApiResponse({
    status: 200,
    description: 'รายการบิลรวม',
    schema: {
      example: [
        {
          id: 1,
          bill_id: 'CB1640995200000123',
          status: 'pending_payment',
          total_amount: 1375,
          created_at: '2023-01-01T12:00:00Z',
          tables_count: 2,
          payments_count: 0,
          table_numbers: [5, 8],
          is_paid: false,
          is_split: false,
          can_pay: true,
          can_cancel: true,
        },
      ],
    },
  })
  async getAllCombinedBills(@Query('status') status?: string) {
    return this.combinedBillService.getAllCombinedBills(status);
  }

  @Get('statistics')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'ดูสถิติการใช้งานบิลรวม',
    description: 'สถิติการสร้างและชำระบิลรวมในช่วงเวลาที่กำหนด',
  })
  @ApiQuery({
    name: 'days',
    required: false,
    description: 'จำนวนวันที่ต้องการดูสถิติ (ค่าเริ่มต้น: 7)',
    example: 7,
  })
  @ApiResponse({
    status: 200,
    description: 'สถิติการใช้งานบิลรวม',
    schema: {
      example: {
        period: 'Last 7 days',
        total_bills: 15,
        paid_bills: 12,
        pending_bills: 2,
        cancelled_bills: 1,
        total_revenue: 18750,
        average_bill_amount: 1562.5,
        average_tables_per_bill: 2.8,
        split_payments_ratio: 35.5,
      },
    },
  })
  async getBillStatistics(@Query('days') days?: string) {
    const daysNumber = days ? parseInt(days) : 7;
    return this.combinedBillService.getBillStatistics(daysNumber);
  }

  @Delete(':billId/cancel')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'ยกเลิกบิลรวม',
    description: 'ยกเลิกบิลรวมที่ยังไม่ได้ชำระเงิน',
  })
  @ApiParam({
    name: 'billId',
    description: 'ID ของบิลรวม',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'ยกเลิกบิลรวมสำเร็จ',
    schema: {
      example: {
        success: true,
        message: 'ຍົກເລີກບິນລວມສຳເລັດ',
        bill_id: 'CB1640995200000123',
        reason: 'ລູກຄ້າຂໍຍົກເລີກ',
        cancelled_at: '2023-01-01T13:00:00Z',
      },
    },
  })
  async cancelCombinedBill(
    @Param('billId') billId: string,
    @Body('reason') reason?: string,
  ) {
    return this.combinedBillService.cancelCombinedBill(+billId, reason);
  }

  // =============== NEW ENDPOINTS FROM SERVICE ===============

  @Get('debug/tables/:tableId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Debug ข้อมูลออเดอร์ของโต๊ะ',
    description:
      'ตรวจสอบรายละเอียดออเดอร์และสถานะการชำระเงินของโต๊ะ (สำหรับ debug)',
  })
  @ApiParam({
    name: 'tableId',
    description: 'ID ของโต๊ะ',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'ข้อมูล debug ของโต๊ะ',
    schema: {
      example: {
        table_id: 1,
        table_number: 5,
        status: 'occupied',
        current_session_start: '2023-01-01T11:00:00Z',
        expected_end_time: '2023-01-01T13:00:00Z',
        orders: [
          {
            id: 1,
            order_id: 'ORD1234567890',
            status: 'completed',
            total_price: 350,
            created_at: '2023-01-01T11:30:00Z',
            payments: [],
            total_paid: 0,
            is_fully_paid: false,
            remaining_amount: 350,
            items: [
              {
                name: 'ข้าวผัดไก่',
                quantity: 1,
                unit_price: 120,
                total_price: 120,
                is_ready: true,
              },
            ],
          },
        ],
      },
    },
  })
  async debugTableOrders(@Param('tableId') tableId: string) {
    return this.combinedBillService.debugTableOrders(+tableId);
  }

  @Get('debug/flow')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Debug กระบวนการทำงานของระบบบิลรวม',
    description: 'ตรวจสอบการทำงานของระบบบิลรวมทั้งหมด (สำหรับ debug)',
  })
  @ApiResponse({
    status: 200,
    description: 'ผลการ debug กระบวนการทำงาน',
    schema: {
      example: {
        success: true,
        message: 'Combined bill flow is working correctly',
        debug_data: {
          unpaid_tables_found: 3,
          test_tables: [1, 2],
          preview_summary: {
            tables_count: 2,
            subtotal: 750,
            service_charge: 75,
            final_amount: 825,
            total_orders: 4,
            total_items: 8,
          },
        },
        recommendations: [
          'System is ready to create combined bills',
          'Tables have unpaid orders available for billing',
          'Preview calculation is working correctly',
        ],
      },
    },
  })
  async debugCombinedBillFlow() {
    return this.combinedBillService.debugCombinedBillFlow();
  }

  @Get('health')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'ตรวจสอบสถานะความพร้อมของระบบบิลรวม',
    description: 'Health check สำหรับระบบบิลรวม',
  })
  @ApiResponse({
    status: 200,
    description: 'สถานะระบบบิลรวม',
    schema: {
      example: {
        status: 'healthy',
        timestamp: '2023-01-01T12:00:00Z',
        database_connection: 'OK',
        data: {
          total_tables: 20,
          total_orders: 150,
          combined_bills: 25,
          tables_with_unpaid_orders: 3,
        },
        features: {
          get_unpaid_tables: 'Available',
          preview_combined_bill: 'Available',
          create_combined_bill: 'Available',
          payment_processing: 'Available',
          split_payment: 'Available',
        },
        message: 'Combined Bills service is fully operational',
      },
    },
  })
  async healthCheck() {
    return this.combinedBillService.healthCheck();
  }

  @Post('debug/reset-table/:tableId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Reset สถานะโต๊ะสำหรับการทดสอบ',
    description:
      'เปลี่ยนสถานะโต๊ะเป็น available และลบ session (สำหรับการทดสอบเท่านั้น)',
  })
  @ApiParam({
    name: 'tableId',
    description: 'ID ของโต๊ะ',
    example: 1,
  })
  @ApiResponse({
    status: 201,
    description: 'Reset โต๊ะสำเร็จ',
    schema: {
      example: {
        success: true,
        message: 'Table 5 reset successfully',
        table: {
          id: 1,
          number: 5,
          status: 'available',
        },
      },
    },
  })
  async resetTableForTesting(@Param('tableId') tableId: string) {
    return this.combinedBillService.resetTableForTesting(+tableId);
  }
}
