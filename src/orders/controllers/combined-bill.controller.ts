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
              order_id: 'ORD1234567890',
              total_price: 350,
              status: 'completed',
              customer_name: 'สมชาย ใจดี',
              items_count: 3,
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
        service_charge: 125,
        final_amount: 1375,
        suggested_split_amount: 458.33,
        table_details: [],
        summary: {
          total_orders: 5,
          total_items: 12,
          average_per_table: 458.33,
        },
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
        message: 'สร้างบิลรวมสำเร็จ',
        combined_bill: {
          id: 1,
          bill_id: 'CB1640995200000',
          subtotal: 1250,
          service_charge: 125,
          final_amount: 1375,
          status: 'pending',
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
    description: 'ชำระบิลรวมทั้งหมดในครั้งเดียว',
  })
  @ApiParam({
    name: 'billId',
    description: 'ID ของบิลรวม',
    example: 1,
  })
  @ApiResponse({
    status: 201,
    description: 'ชำระบิลรวมสำเร็จ',
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
  @ApiResponse({
    status: 201,
    description: 'แบ่งจ่ายบิลรวมสำเร็จ',
  })
  async splitPayCombinedBill(
    @Param('billId') billId: string,
    @Body() splitBillDto: SplitBillDto,
  ) {
    return this.combinedBillService.splitPayCombinedBill(+billId, splitBillDto);
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
  @ApiResponse({
    status: 200,
    description: 'ยกเลิกบิลรวมสำเร็จ',
  })
  async cancelCombinedBill(
    @Param('billId') billId: string,
    @Body('reason') reason?: string,
  ) {
    return this.combinedBillService.cancelCombinedBill(+billId, reason);
  }

  @Get(':billId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'ดูรายละเอียดบิลรวม',
    description: 'แสดงรายละเอียดบิลรวม รวมถึงโต๊ะ ออเดอร์ และการชำระเงิน',
  })
  @ApiResponse({
    status: 200,
    description: 'รายละเอียดบิลรวม',
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
    description: 'กรองตามสถานะ (pending, paid, cancelled)',
    example: 'pending',
  })
  @ApiResponse({
    status: 200,
    description: 'รายการบิลรวม',
  })
  async getAllCombinedBills(@Query('status') status?: string) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return this.combinedBillService.getAllCombinedBills(status);
  }
}
