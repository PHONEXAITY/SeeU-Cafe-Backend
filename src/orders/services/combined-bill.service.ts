// src/orders/services/combined-bill.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCombinedBillDto } from '../dto/create-combined-bill.dto';
import { SplitBillDto } from '../dto/split-bill.dto';

@Injectable()
export class CombinedBillService {
  constructor(private readonly prisma: PrismaService) {}

  async getTablesWithUnpaidOrders() {
    // หาโต๊ะที่มี orders ที่ยังไม่ได้จ่าย
    const tables = await this.prisma.table.findMany({
      where: {
        status: 'occupied',
        orders: {
          some: {
            status: {
              in: ['completed', 'ready', 'served'], // สถานะที่พร้อมจ่าย
            },
            payments: {
              none: {
                status: 'completed', // ยังไม่มีการจ่ายเงินที่สำเร็จ
              },
            },
          },
        },
      },
      include: {
        orders: {
          where: {
            status: {
              in: ['completed', 'ready', 'served'],
            },
            payments: {
              none: {
                status: 'completed',
              },
            },
          },
          include: {
            order_details: {
              include: {
                food_menu: true,
                beverage_menu: true,
              },
            },
            user: {
              select: {
                id: true,
                first_name: true,
                last_name: true,
              },
            },
          },
        },
      },
    });

    return tables.map((table) => {
      const totalAmount = table.orders.reduce(
        (sum, order) => sum + order.total_price,
        0,
      );

      return {
        table_id: table.id,
        table_number: table.number,
        capacity: table.capacity,
        total_orders: table.orders.length,
        total_amount: totalAmount,
        session_duration: table.current_session_start
          ? Math.floor(
              (new Date().getTime() - table.current_session_start.getTime()) /
                (1000 * 60),
            )
          : 0,
        orders: table.orders.map((order) => ({
          order_id: order.order_id,
          total_price: order.total_price,
          status: order.status,
          customer_name: order.user
            ? `${order.user.first_name || ''} ${order.user.last_name || ''}`.trim()
            : null,
          items_count: order.order_details.length,
          created_at: order.create_at,
        })),
      };
    });
  }

  async previewCombinedBill(tableIds: number[]) {
    if (tableIds.length < 2) {
      throw new BadRequestException('ต้องการอย่างน้อย 2 โต๊ะสำหรับรวมบิล');
    }

    // ตรวจสอบว่าโต๊ะทั้งหมดมีอยู่จริง
    const tables = await this.prisma.table.findMany({
      where: {
        id: { in: tableIds },
      },
      include: {
        orders: {
          where: {
            status: {
              in: ['completed', 'ready', 'served'],
            },
            payments: {
              none: {
                status: 'completed',
              },
            },
          },
          include: {
            order_details: {
              include: {
                food_menu: true,
                beverage_menu: true,
              },
            },
            user: {
              select: {
                id: true,
                first_name: true,
                last_name: true,
              },
            },
          },
        },
      },
    });

    if (tables.length !== tableIds.length) {
      throw new NotFoundException('ไม่พบโต๊ะบางโต๊ะที่ระบุ');
    }

    // ตรวจสอบว่าทุกโต๊ะมี unpaid orders
    const tablesWithoutUnpaidOrders = tables.filter(
      (table) => table.orders.length === 0,
    );
    if (tablesWithoutUnpaidOrders.length > 0) {
      throw new BadRequestException(
        `โต๊ะ ${tablesWithoutUnpaidOrders.map((t) => t.number).join(', ')} ไม่มีออเดอร์ที่ยังไม่ได้ชำระ`,
      );
    }

    let subtotal = 0;
    const billDetails = tables.map((table) => {
      const tableTotal = table.orders.reduce(
        (sum, order) => sum + order.total_price,
        0,
      );
      subtotal += tableTotal;

      return {
        table_id: table.id,
        table_number: table.number,
        table_total: tableTotal,
        orders_count: table.orders.length,
        order_ids: table.orders.map((order) => order.id),
        orders: table.orders.map((order) => ({
          order_id: order.order_id,
          total_price: order.total_price,
          status: order.status,
          customer_name: order.user
            ? `${order.user.first_name || ''} ${order.user.last_name || ''}`.trim()
            : 'ลูกค้าทั่วไป',
          items: order.order_details.map((detail) => ({
            name: detail.food_menu?.name || detail.beverage_menu?.name,
            quantity: detail.quantity,
            price: detail.price,
            total: detail.quantity * detail.price,
            notes: detail.notes,
          })),
        })),
      };
    });

    const serviceCharge = Math.round(subtotal * 0.1 * 100) / 100; // 10% service charge
    const finalAmount = subtotal + serviceCharge;

    return {
      preview_id: `PREVIEW_${Date.now()}`,
      tables_count: tables.length,
      subtotal: subtotal,
      service_charge: serviceCharge,
      final_amount: finalAmount,
      suggested_split_amount:
        Math.round((finalAmount / tables.length) * 100) / 100,
      table_details: billDetails,
      summary: {
        total_orders: billDetails.reduce(
          (sum, table) => sum + table.orders_count,
          0,
        ),
        total_items: billDetails.reduce(
          (sum, table) =>
            sum +
            table.orders.reduce(
              (orderSum, order) => orderSum + order.items.length,
              0,
            ),
          0,
        ),
        average_per_table:
          Math.round((finalAmount / tables.length) * 100) / 100,
      },
      created_at: new Date().toISOString(),
    };
  }

  async createCombinedBill(createCombinedBillDto: CreateCombinedBillDto) {
    const { table_ids, payment_method, notes, customer_name } =
      createCombinedBillDto;

    // ตรวจสอบ preview ก่อน
    const preview = await this.previewCombinedBill(table_ids);

    // สร้าง combined bill โดยใช้ Order table ก่อน (เพื่อไม่ต้องเปลี่ยน schema)
    const result = await this.prisma.$transaction(async (tx) => {
      // สร้าง virtual combined order
      const combinedOrder = await tx.order.create({
        data: {
          order_id: `CB${Date.now()}`,
          status: 'pending_payment',
          total_price: preview.final_amount,
          order_type: 'combined_bill',
          preparation_notes: `Combined bill for tables: ${preview.table_details.map((t) => t.table_number).join(', ')}${notes ? `. Notes: ${notes}` : ''}${customer_name ? `. Customer: ${customer_name}` : ''}`,
        },
      });

      // สร้าง order details สำหรับแต่ละโต๊ะ
      const orderDetails: any[] = []; // 🔥 FIX: กำหนด type เป็น any[]
      for (const tableDetail of preview.table_details) {
        const detail = await tx.orderDetail.create({
          data: {
            order_id: combinedOrder.id,
            quantity: 1,
            price: tableDetail.table_total,
            notes: `Table ${tableDetail.table_number} - ${tableDetail.orders_count} orders - Order IDs: ${tableDetail.order_ids.join(',')}`,
          },
        });
        orderDetails.push(detail);
      }

      return { combinedOrder, orderDetails, preview };
    });

    return {
      success: true,
      message: 'สร้างบิลรวมสำเร็จ',
      combined_bill: {
        id: result.combinedOrder.id,
        bill_id: result.combinedOrder.order_id,
        subtotal: preview.subtotal,
        service_charge: preview.service_charge,
        final_amount: result.combinedOrder.total_price,
        status: result.combinedOrder.status,
        customer_name: customer_name,
        notes: notes,
        created_at: result.combinedOrder.create_at,
      },
      tables_included: result.preview.table_details.map((tb) => ({
        table_number: tb.table_number,
        subtotal: tb.table_total,
        orders_count: tb.orders_count,
      })),
      payment_info: {
        amount_to_pay: result.combinedOrder.total_price,
        suggested_method: payment_method || 'cash',
        can_split: true,
      },
    };
  }

  async payCombinedBill(
    billId: number,
    paymentMethod?: string,
    notes?: string,
  ) {
    // หา combined bill
    const combinedBill = await this.prisma.order.findUnique({
      where: {
        id: billId,
        order_type: 'combined_bill',
      },
      include: {
        order_details: true,
        payments: true,
      },
    });

    if (!combinedBill) {
      throw new NotFoundException('ไม่พบบิลรวมที่ระบุ');
    }

    if (combinedBill.status === 'completed') {
      throw new ConflictException('บิลรวมนี้ชำระเงินแล้ว');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // สร้าง payment record
      const payment = await tx.payment.create({
        data: {
          order_id: billId,
          payment_id: BigInt(Date.now()),
          amount: combinedBill.total_price,
          method: paymentMethod || 'cash',
          status: 'completed',
          payment_date: new Date(),
          notes: notes,
          transaction_reference: `CB_FULL_${combinedBill.order_id}`,
        },
      });

      // อัปเดต combined bill status
      const updatedBill = await tx.order.update({
        where: { id: billId },
        data: { status: 'completed' },
      });

      // จัดการ orders และโต๊ะ
      const releasedTables: Array<{
        table_number: number;
        orders_completed: number;
      }> = []; // 🔥 FIX: กำหนด type ชัดเจน

      // แยก table numbers และ order IDs จาก order_details
      for (const detail of combinedBill.order_details) {
        if (detail.notes && detail.notes.includes('Order IDs:')) {
          const orderIdsMatch = detail.notes.match(/Order IDs: ([\d,]+)/);
          const tableNumberMatch = detail.notes.match(/Table (\d+)/);

          if (orderIdsMatch && tableNumberMatch) {
            const orderIds = orderIdsMatch[1]
              .split(',')
              .map((id) => parseInt(id.trim()));
            const tableNumber = parseInt(tableNumberMatch[1]);

            // สร้าง payment สำหรับแต่ละ order
            for (const orderId of orderIds) {
              const order = await tx.order.findUnique({
                where: { id: orderId },
              });

              if (order) {
                await tx.payment.create({
                  data: {
                    order_id: orderId,
                    payment_id: BigInt(Date.now() + Math.random() * 1000),
                    amount: order.total_price,
                    method: paymentMethod || 'cash',
                    status: 'completed',
                    payment_date: new Date(),
                    notes: `ชำระผ่านบิลรวม #${combinedBill.order_id}`,
                    transaction_reference: `CB_${combinedBill.order_id}`,
                  },
                });

                // อัปเดต order status
                await tx.order.update({
                  where: { id: orderId },
                  data: { status: 'completed' },
                });
              }
            }

            // หาโต๊ะและปล่อย
            const table = await tx.table.findFirst({
              where: { number: tableNumber },
            });

            if (table) {
              await tx.table.update({
                where: { id: table.id },
                data: {
                  status: 'available',
                  current_session_start: null,
                  expected_end_time: null,
                },
              });

              releasedTables.push({
                table_number: tableNumber,
                orders_completed: orderIds.length,
              });
            }
          }
        }
      }

      return { payment, updatedBill, releasedTables };
    });

    return {
      success: true,
      message: 'ชำระบิลรวมสำเร็จ',
      payment: {
        id: result.payment.id,
        amount: result.payment.amount,
        method: result.payment.method,
        paid_at: result.payment.payment_date,
        notes: result.payment.notes,
      },
      bill: {
        bill_id: combinedBill.order_id,
        final_amount: combinedBill.total_price,
        status: 'paid',
      },
      tables_released: result.releasedTables,
    };
  }

  async splitPayCombinedBill(billId: number, splitBillDto: SplitBillDto) {
    const combinedBill = await this.prisma.order.findUnique({
      where: {
        id: billId,
        order_type: 'combined_bill',
      },
      include: {
        order_details: true,
        payments: true,
      },
    });

    if (!combinedBill) {
      throw new NotFoundException('ไม่พบบิลรวมที่ระบุ');
    }

    if (combinedBill.status === 'completed') {
      throw new ConflictException('บิลรวมนี้ชำระเงินแล้ว');
    }

    // ตรวจสอบว่าผลรวมของ split เท่ากับยอดรวม
    const totalSplitAmount = splitBillDto.splits.reduce(
      (sum, split) => sum + split.amount,
      0,
    );

    if (Math.abs(totalSplitAmount - combinedBill.total_price) > 0.01) {
      throw new BadRequestException(
        `ยอดแบ่งจ่าย (₭${totalSplitAmount.toLocaleString()}) ไม่เท่ากับยอดรวม (₭${combinedBill.total_price.toLocaleString()})`,
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const splitPayments: any[] = []; // 🔥 FIX: กำหนด type เป็น any[]
      const handledTables = new Set();

      // สร้าง payment สำหรับแต่ละ split
      for (const split of splitBillDto.splits) {
        const splitPayment = await tx.payment.create({
          data: {
            order_id: billId,
            payment_id: BigInt(Date.now() + Math.random() * 1000),
            amount: split.amount,
            method: split.payment_method || 'cash',
            status: 'completed',
            payment_date: new Date(),
            notes: `แบ่งจ่ายโต๊ะ ${split.table_id}${splitBillDto.notes ? ` - ${splitBillDto.notes}` : ''}`,
            transaction_reference: `SPLIT_${combinedBill.order_id}_T${split.table_id}`,
          },
        });
        splitPayments.push(splitPayment);

        // หา order detail ที่เกี่ยวข้องกับโต๊ะนี้
        const tableDetail = combinedBill.order_details.find(
          (detail) =>
            detail.notes && detail.notes.includes(`Table ${split.table_id}`),
        );

        if (tableDetail && !handledTables.has(split.table_id)) {
          const orderIdsMatch = tableDetail.notes?.match(/Order IDs: ([\d,]+)/);

          if (orderIdsMatch) {
            const orderIds = orderIdsMatch[1]
              .split(',')
              .map((id) => parseInt(id.trim()));

            // สร้าง payment สำหรับ orders ของโต๊ะนี้
            for (const orderId of orderIds) {
              const order = await tx.order.findUnique({
                where: { id: orderId },
              });

              if (order) {
                await tx.payment.create({
                  data: {
                    order_id: orderId,
                    payment_id: BigInt(Date.now() + Math.random() * 1000),
                    amount: order.total_price,
                    method: split.payment_method || 'cash',
                    status: 'completed',
                    payment_date: new Date(),
                    notes: `แบ่งจ่ายจากบิลรวม #${combinedBill.order_id}`,
                    transaction_reference: `SPLIT_${combinedBill.order_id}_T${split.table_id}`,
                  },
                });

                await tx.order.update({
                  where: { id: orderId },
                  data: { status: 'completed' },
                });
              }
            }
          }

          // ปล่อยโต๊ะ
          await tx.table.update({
            where: { id: split.table_id },
            data: {
              status: 'available',
              current_session_start: null,
              expected_end_time: null,
            },
          });

          handledTables.add(split.table_id);
        }
      }

      // อัปเดต combined bill
      const updatedBill = await tx.order.update({
        where: { id: billId },
        data: { status: 'completed' },
      });

      return {
        splitPayments,
        updatedBill,
        handledTablesCount: handledTables.size,
      };
    });

    return {
      success: true,
      message: 'แบ่งจ่ายบิลรวมสำเร็จ',
      total_amount: totalSplitAmount,
      split_payments: result.splitPayments.map((payment: any) => ({
        // 🔥 FIX: cast เป็น any
        payment_id: payment.id,
        amount: payment.amount,
        method: payment.method,
        table_reference: payment.notes,
      })),
      tables_processed: result.handledTablesCount,
      paid_at: new Date().toISOString(),
    };
  }

  async getCombinedBill(billId: number) {
    const combinedBill = await this.prisma.order.findUnique({
      where: {
        id: billId,
        order_type: 'combined_bill',
      },
      include: {
        order_details: true,
        payments: true,
      },
    });

    if (!combinedBill) {
      throw new NotFoundException('ไม่พบบิลรวมที่ระบุ');
    }

    // แยกข้อมูลโต๊ะจาก order_details
    const tableDetails: any[] = []; // 🔥 FIX: กำหนด type เป็น any[]
    for (const detail of combinedBill.order_details) {
      if (detail.notes) {
        const tableNumberMatch = detail.notes.match(/Table (\d+)/);
        const orderIdsMatch = detail.notes.match(/Order IDs: ([\d,]+)/);

        if (tableNumberMatch && orderIdsMatch) {
          const tableNumber = parseInt(tableNumberMatch[1]);
          const orderIds = orderIdsMatch[1]
            .split(',')
            .map((id) => parseInt(id.trim()));

          // ดึงรายละเอียด orders
          const orders = await this.prisma.order.findMany({
            where: { id: { in: orderIds } },
            include: {
              order_details: {
                include: {
                  food_menu: true,
                  beverage_menu: true,
                },
              },
              user: {
                select: {
                  first_name: true,
                  last_name: true,
                },
              },
            },
          });

          tableDetails.push({
            table_number: tableNumber,
            subtotal: detail.price,
            orders: orders.map((order) => ({
              order_id: order.order_id,
              total_price: order.total_price,
              customer_name: order.user
                ? `${order.user.first_name || ''} ${order.user.last_name || ''}`.trim()
                : 'ลูกค้าทั่วไป',
              items: order.order_details.map((orderDetail) => ({
                name:
                  orderDetail.food_menu?.name ||
                  orderDetail.beverage_menu?.name,
                quantity: orderDetail.quantity,
                price: orderDetail.price,
                total: orderDetail.quantity * orderDetail.price,
                notes: orderDetail.notes,
              })),
            })),
          });
        }
      }
    }

    return {
      id: combinedBill.id,
      bill_id: combinedBill.order_id,
      status: combinedBill.status,
      total_amount: combinedBill.total_price,
      notes: combinedBill.preparation_notes,
      created_at: combinedBill.create_at,
      table_details: tableDetails,
      payments: combinedBill.payments.map((payment) => ({
        id: payment.id,
        amount: payment.amount,
        method: payment.method,
        paid_at: payment.payment_date,
        notes: payment.notes,
      })),
      summary: {
        tables_count: tableDetails.length,
        total_payments: combinedBill.payments.length,
        is_split_payment: combinedBill.payments.length > 1,
        payment_status: combinedBill.status,
      },
    };
  }

  async getAllCombinedBills(status?: string) {
    const where: any = {
      order_type: 'combined_bill',
    };

    if (status) {
      where.status = status;
    }

    const bills = await this.prisma.order.findMany({
      where,
      include: {
        order_details: true,
        payments: true,
      },
      orderBy: {
        create_at: 'desc',
      },
    });

    return bills.map((bill) => {
      // นับโต๊ะจาก order_details
      const tablesCount = bill.order_details.length;
      const tableNumbers = bill.order_details
        .map((detail) => {
          const match = detail.notes?.match(/Table (\d+)/);
          return match ? parseInt(match[1]) : null;
        })
        .filter((num) => num !== null)
        .sort();

      return {
        id: bill.id,
        bill_id: bill.order_id,
        status: bill.status,
        total_amount: bill.total_price,
        created_at: bill.create_at,
        tables_count: tablesCount,
        payments_count: bill.payments.length,
        table_numbers: tableNumbers,
        is_paid: bill.status === 'completed',
        is_split: bill.payments.length > 1,
      };
    });
  }

  // Utility methods
  async getBillStatistics(days: number = 7) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const bills = await this.prisma.order.findMany({
      where: {
        order_type: 'combined_bill',
        create_at: {
          gte: startDate,
        },
      },
      include: {
        order_details: true,
        payments: true,
      },
    });

    const totalRevenue = bills
      .filter((bill) => bill.status === 'completed')
      .reduce((sum, bill) => sum + bill.total_price, 0);

    const averageTablesPerBill =
      bills.length > 0
        ? bills.reduce((sum, bill) => sum + bill.order_details.length, 0) /
          bills.length
        : 0;

    return {
      period: `Last ${days} days`,
      total_bills: bills.length,
      paid_bills: bills.filter((bill) => bill.status === 'completed').length,
      pending_bills: bills.filter((bill) => bill.status === 'pending_payment')
        .length,
      total_revenue: totalRevenue,
      average_bill_amount:
        bills.length > 0
          ? totalRevenue /
            bills.filter((bill) => bill.status === 'completed').length
          : 0,
      average_tables_per_bill: Math.round(averageTablesPerBill * 100) / 100,
      split_payments_ratio:
        bills.length > 0
          ? (bills.filter((bill) => bill.payments.length > 1).length /
              bills.length) *
            100
          : 0,
    };
  }

  async cancelCombinedBill(billId: number, reason?: string) {
    const combinedBill = await this.prisma.order.findUnique({
      where: {
        id: billId,
        order_type: 'combined_bill',
      },
      include: {
        payments: true,
      },
    });

    if (!combinedBill) {
      throw new NotFoundException('ไม่พบบิลรวมที่ระบุ');
    }

    if (combinedBill.status === 'completed') {
      throw new ConflictException('ไม่สามารถยกเลิกบิลที่ชำระเงินแล้ว');
    }

    await this.prisma.order.update({
      where: { id: billId },
      data: {
        status: 'cancelled',
        preparation_notes: combinedBill.preparation_notes
          ? `${combinedBill.preparation_notes} | ยกเลิก: ${reason || 'ไม่ระบุเหตุผล'}`
          : `ยกเลิก: ${reason || 'ไม่ระบุเหตุผล'}`,
      },
    });

    return {
      success: true,
      message: 'ยกเลิกบิลรวมสำเร็จ',
      bill_id: combinedBill.order_id,
      reason: reason || 'ไม่ระบุเหตุผล',
      cancelled_at: new Date().toISOString(),
    };
  }
}
