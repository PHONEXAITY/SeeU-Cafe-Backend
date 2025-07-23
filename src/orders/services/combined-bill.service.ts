/* eslint-disable @typescript-eslint/no-unsafe-argument */
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
    console.log('🔍 Debug: Starting getTablesWithUnpaidOrders');

    // 🔧 ขั้นตอนที่ 1: หาโต๊ะทั้งหมดที่มี orders (เพิ่ม processing)
    const allTablesWithOrders = await this.prisma.table.findMany({
      where: {
        orders: {
          some: {
            // ✅ เพิ่ม 'processing' ในรายการ status
            status: {
              in: [
                'pending',
                'preparing',
                'processing',
                'ready',
                'completed',
                'served',
              ],
            },
          },
        },
      },
      include: {
        orders: {
          where: {
            status: {
              // ✅ เพิ่ม 'processing' ที่นี่ด้วย
              in: [
                'pending',
                'preparing',
                'processing',
                'ready',
                'completed',
                'served',
              ],
            },
          },
          include: {
            order_details: {
              include: {
                food_menu: {
                  select: {
                    id: true,
                    name: true,
                    price: true,
                    image: true,
                    category: {
                      select: { name: true },
                    },
                  },
                },
                beverage_menu: {
                  select: {
                    id: true,
                    name: true,
                    hot_price: true,
                    ice_price: true,
                    image: true,
                    category: {
                      select: { name: true },
                    },
                  },
                },
              },
            },
            user: {
              select: {
                id: true,
                first_name: true,
                last_name: true,
                phone: true,
              },
            },
            promotion: {
              select: {
                id: true,
                name: true,
                discount_type: true,
                discount_value: true,
              },
            },
            payments: true,
          },
        },
      },
    });

    console.log(
      `🔍 Debug: Found ${allTablesWithOrders.length} tables with orders`,
    );

    // 🔧 ขั้นตอนที่ 2: กรองเฉพาะโต๊ะที่ยังไม่ได้ชำระเงินครบ
    const tablesWithUnpaidOrders = allTablesWithOrders.filter((table) => {
      const unpaidOrders = table.orders.filter((order) => {
        // คำนวณยอดที่ชำระแล้ว
        const totalPaid = order.payments
          .filter((payment) => payment.status === 'completed')
          .reduce((sum, payment) => sum + payment.amount, 0);

        // ถ้ายอดที่ชำระน้อยกว่ายอดรวม = ยังไม่ได้ชำระครบ
        const isUnpaid = totalPaid < order.total_price;

        console.log(
          `🔍 Debug: Order ${order.order_id} (${order.status}) - Total: ${order.total_price}, Paid: ${totalPaid}, Unpaid: ${isUnpaid}`,
        );

        return isUnpaid;
      });

      const hasUnpaidOrders = unpaidOrders.length > 0;

      console.log(
        `🔍 Debug: Table ${table.number} - ${unpaidOrders.length} unpaid orders out of ${table.orders.length} total orders`,
      );

      return hasUnpaidOrders;
    });

    console.log(
      `🔍 Debug: Found ${tablesWithUnpaidOrders.length} tables with unpaid orders`,
    );

    // 🔧 ขั้นตอนที่ 3: จัดรูปแบบข้อมูลเพื่อส่งกลับ
    const result = tablesWithUnpaidOrders.map((table) => {
      // กรองเฉพาะ orders ที่ยังไม่ได้ชำระครบ
      const unpaidOrders = table.orders.filter((order) => {
        const totalPaid = order.payments
          .filter((payment) => payment.status === 'completed')
          .reduce((sum, payment) => sum + payment.amount, 0);
        return totalPaid < order.total_price;
      });

      const totalAmount = unpaidOrders.reduce(
        (sum, order) => sum + order.total_price,
        0,
      );

      console.log(
        `🔍 Debug: Table ${table.number} final result - ${unpaidOrders.length} orders, total: ${totalAmount}`,
      );

      return {
        table_id: table.id,
        table_number: table.number,
        capacity: table.capacity,
        total_orders: unpaidOrders.length,
        total_amount: totalAmount,
        session_duration: table.current_session_start
          ? Math.floor(
              (new Date().getTime() - table.current_session_start.getTime()) /
                (1000 * 60),
            )
          : 0,
        orders: unpaidOrders.map((order) => {
          const totalPaid = order.payments
            .filter((payment) => payment.status === 'completed')
            .reduce((sum, payment) => sum + payment.amount, 0);

          return {
            id: order.id,
            order_id: order.order_id,
            total_price: order.total_price,
            discount_amount: order.discount_amount || 0,
            net_amount: order.total_price,
            status: order.status,
            created_at: order.create_at,
            estimated_ready_time: order.estimated_ready_time,
            actual_ready_time: order.actual_ready_time,
            customer_info: {
              name: order.user
                ? `${order.user.first_name || ''} ${order.user.last_name || ''}`.trim()
                : 'ລູກຄ້າທົ່ວໄປ',
              phone: order.user?.phone || null,
            },
            promotion: order.promotion
              ? {
                  name: order.promotion.name,
                  discount_type: order.promotion.discount_type,
                  discount_value: order.promotion.discount_value,
                }
              : null,
            // ✅ เพิ่มรายละเอียดเมนูครบถ้วน
            items: order.order_details.map((detail) => ({
              id: detail.id,
              name:
                detail.food_menu?.name ||
                detail.beverage_menu?.name ||
                'ບໍ່ລະບຸຊື່',
              category:
                detail.food_menu?.category?.name ||
                detail.beverage_menu?.category?.name ||
                'ອື່ນໆ',
              quantity: detail.quantity,
              unit_price: detail.price,
              total_price: detail.quantity * detail.price,
              notes: detail.notes || '',
              type: detail.food_menu ? 'food' : 'beverage',
              menu_image:
                detail.food_menu?.image || detail.beverage_menu?.image || null,
              is_ready: detail.is_ready,
            })),
            items_count: order.order_details.length,
            // 🔍 เพิ่มข้อมูล payment สำหรับ debug
            payment_status: {
              total_paid: totalPaid,
              remaining_amount: order.total_price - totalPaid,
              has_payments: order.payments.length > 0,
              payments: order.payments.map((p) => ({
                id: p.id,
                amount: p.amount,
                status: p.status,
                method: p.method,
                payment_date: p.payment_date,
              })),
            },
          };
        }),
      };
    });

    console.log(
      `🔍 Debug: Returning ${result.length} tables with unpaid orders`,
    );

    return result;
  }

  async previewCombinedBill(tableIds: number[]) {
    if (tableIds.length < 2) {
      throw new BadRequestException('ຕ້ອງການຢ່າງໜ້ອຍ 2 ໂຕະສຳລັບລວມບິນ');
    }

    console.log('🔍 Debug: Previewing combined bill for tables:', tableIds);

    // ตรวจสอบว่าโต๊ะทั้งหมดมีอยู่จริง
    const tables = await this.prisma.table.findMany({
      where: {
        id: { in: tableIds },
      },
      include: {
        orders: {
          where: {
            status: {
              // ✅ เพิ่ม 'processing' ในรายการ status
              in: [
                'pending',
                'preparing',
                'processing',
                'ready',
                'completed',
                'served',
              ],
            },
          },
          include: {
            order_details: {
              include: {
                food_menu: {
                  select: {
                    id: true,
                    name: true,
                    price: true,
                    image: true,
                    category: { select: { name: true } },
                  },
                },
                beverage_menu: {
                  select: {
                    id: true,
                    name: true,
                    hot_price: true,
                    ice_price: true,
                    image: true,
                    category: { select: { name: true } },
                  },
                },
              },
            },
            user: {
              select: {
                id: true,
                first_name: true,
                last_name: true,
                phone: true,
                email: true,
              },
            },
            promotion: {
              select: {
                id: true,
                name: true,
                discount_type: true,
                discount_value: true,
              },
            },
            payments: true, // เพิ่มข้อมูล payments
          },
        },
      },
    });

    if (tables.length !== tableIds.length) {
      throw new NotFoundException('ບໍ່ພົບໂຕະບາງໂຕະທີ່ລະບຸ');
    }

    // ✅ ปรับการตรวจสอบ unpaid orders
    const tablesWithoutUnpaidOrders = tables.filter((table) => {
      const unpaidOrders = table.orders.filter((order) => {
        const totalPaid = order.payments
          .filter((p) => p.status === 'completed')
          .reduce((sum, p) => sum + p.amount, 0);
        return totalPaid < order.total_price;
      });
      return unpaidOrders.length === 0;
    });

    if (tablesWithoutUnpaidOrders.length > 0) {
      throw new BadRequestException(
        `ໂຕະ ${tablesWithoutUnpaidOrders.map((t) => t.number).join(', ')} ບໍ່ມີອໍເດີ້ທີ່ຍັງບໍ່ໄດ້ຊຳລະ`,
      );
    }

    let subtotal = 0;
    let totalDiscount = 0;

    // ✅ สร้างรายละเอียดบิลครบถ้วน
    const billDetails = tables.map((table) => {
      // คำนวณเฉพาะ orders ที่ยังไม่ได้ชำระครบ
      const unpaidOrders = table.orders.filter((order) => {
        const totalPaid = order.payments
          .filter((p) => p.status === 'completed')
          .reduce((sum, p) => sum + p.amount, 0);
        return totalPaid < order.total_price;
      });

      const tableSubtotal = unpaidOrders.reduce(
        (sum, order) => sum + order.total_price,
        0,
      );
      const tableDiscount = unpaidOrders.reduce(
        (sum, order) => sum + (order.discount_amount || 0),
        0,
      );

      subtotal += tableSubtotal;
      totalDiscount += tableDiscount;

      return {
        table_id: table.id,
        table_number: table.number,
        table_subtotal: tableSubtotal, // ✅ แก้ไข: ใช้ table_subtotal แทน table_total
        table_discount: tableDiscount,
        table_net_total: tableSubtotal,
        orders_count: unpaidOrders.length,
        order_ids: unpaidOrders.map((order) => order.id),
        orders: unpaidOrders.map((order) => ({
          id: order.id,
          order_id: order.order_id,
          subtotal: order.total_price + (order.discount_amount || 0),
          discount_amount: order.discount_amount || 0,
          total_price: order.total_price,
          status: order.status,
          created_at: order.create_at,
          customer_info: {
            name: order.user
              ? `${order.user.first_name || ''} ${order.user.last_name || ''}`.trim()
              : 'ລູກຄ້າທົ່ວໄປ',
            phone: order.user?.phone || null,
            email: order.user?.email || null,
          },
          promotion: order.promotion
            ? {
                name: order.promotion.name,
                discount_type: order.promotion.discount_type,
                discount_value: order.promotion.discount_value,
              }
            : null,
          // ✅ รายละเอียดเมนูครบถ้วน
          items: order.order_details.map((detail) => ({
            id: detail.id,
            name:
              detail.food_menu?.name ||
              detail.beverage_menu?.name ||
              'ບໍ່ລະບຸຊື່',
            category:
              detail.food_menu?.category?.name ||
              detail.beverage_menu?.category?.name ||
              'ອື່ນໆ',
            quantity: detail.quantity,
            unit_price: detail.price,
            total_price: detail.quantity * detail.price,
            notes: detail.notes || '',
            type: detail.food_menu ? 'food' : 'beverage',
            menu_image:
              detail.food_menu?.image || detail.beverage_menu?.image || null,
            is_ready: detail.is_ready,
          })),
        })),
      };
    });

    const serviceCharge = Math.round(subtotal * 0.1 * 100) / 100; // 10% service charge
    const finalAmount = subtotal + serviceCharge;

    console.log('🔍 Debug: Preview calculation:', {
      subtotal,
      totalDiscount,
      serviceCharge,
      finalAmount,
      tablesCount: tables.length,
    });

    return {
      preview_id: `PREVIEW_${Date.now()}`,
      tables_count: tables.length,
      subtotal: subtotal,
      total_discount: totalDiscount,
      net_amount: subtotal,
      service_charge: serviceCharge,
      service_charge_rate: 0.1,
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
        payment_methods_suggested: ['cash', 'card', 'transfer'],
      },
      created_at: new Date().toISOString(),
    };
  }

  async createCombinedBill(createCombinedBillDto: CreateCombinedBillDto) {
    const { table_ids, payment_method, notes, customer_name } =
      createCombinedBillDto;

    console.log('🔧 Debug: Creating combined bill for tables:', table_ids);

    // ✅ ตรวจสอบ preview ก่อน
    const preview = await this.previewCombinedBill(table_ids);

    // สร้าง combined bill โดยใช้ Order table (ใช้ existing schema)
    const result = await this.prisma.$transaction(async (tx) => {
      console.log('🔧 Debug: Starting transaction for combined bill creation');

      // สร้าง virtual combined order
      const combinedOrder = await tx.order.create({
        data: {
          order_id: `CB${Date.now()}${Math.floor(Math.random() * 1000)}`,
          status: 'pending_payment',
          total_price: preview.final_amount,
          order_type: 'combined_bill',
          preparation_notes: `Combined bill for tables: ${preview.table_details.map((t) => t.table_number).join(', ')}${notes ? `. Notes: ${notes}` : ''}${customer_name ? `. Customer: ${customer_name}` : ''}`,
        },
      });

      console.log('🔧 Debug: Created combined bill:', combinedOrder.id);

      // สร้าง order details สำหรับแต่ละโต๊ะ
      const orderDetails: any[] = []; // ✅ แก้ไข: กำหนด type ชัดเจน
      for (const tableDetail of preview.table_details) {
        const detail = await tx.orderDetail.create({
          data: {
            order_id: combinedOrder.id,
            quantity: 1,
            price: tableDetail.table_subtotal, // ✅ แก้ไข: ใช้ table_subtotal
            notes: `Table ${tableDetail.table_number} - ${tableDetail.orders_count} orders - Order IDs: ${tableDetail.order_ids.join(',')}`,
          },
        });
        orderDetails.push(detail);
        console.log(
          `🔧 Debug: Created order detail for table ${tableDetail.table_number}`,
        );
      }

      return { combinedOrder, orderDetails, preview };
    });

    console.log('🔧 Debug: Combined bill creation completed');

    return {
      success: true,
      message: 'ສ້າງບິນລວມສຳເລັດ',
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
        subtotal: tb.table_subtotal, // ✅ แก้ไข: ใช้ table_subtotal
        orders_count: tb.orders_count,
      })),
      payment_info: {
        amount_to_pay: result.combinedOrder.total_price,
        suggested_method: payment_method || 'cash',
        can_split: true,
      },
    };
  }
  async updatePaymentStatus(orderId, amount, method, notes) {
    try {
      // ใช้ Prisma โดยตรงแทนการเรียก paymentService
      const payment = await this.prisma.payment.create({
        data: {
          order_id: parseInt(orderId),
          payment_id: BigInt(Date.now() + Math.random() * 1000),
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
          amount: parseFloat(amount),
          method: method,
          status: 'completed',
          payment_date: new Date(),
          notes: notes || 'ຊຳລະຜ່ານບິນລວມ',
          transaction_reference: `CB_${Date.now()}_${orderId}`,
        },
      });

      console.log('💰 Payment record created directly:', payment.id);
      return payment;
    } catch (error) {
      console.error('❌ Error creating payment record:', error);

      // ไม่ throw error เพื่อไม่ให้กระทบกับ combined bill transaction
      // เพียงแต่ log warning
      console.warn(
        `⚠️ Could not create payment record for order ${orderId}, but combined bill will continue`,
      );
      return null;
    }
  }

  async payCombinedBill(
    billId: number,
    paymentMethod?: string,
    notes?: string,
  ) {
    console.log('💰 Debug: Processing payment for combined bill:', billId);

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
      throw new NotFoundException('ບໍ່ພົບບິນລວມທີ່ລະບຸ');
    }

    if (combinedBill.status === 'completed') {
      throw new ConflictException('บิลรวมนี้ชำระเงินแล้ว');
    }

    // ✅ ปรับปรุง transaction handling
    const result = await this.prisma.$transaction(
      async (tx) => {
        console.log('💰 Debug: Starting payment transaction');

        // สร้าง payment record สำหรับ combined bill
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

        console.log('💰 Debug: Created main payment record:', payment.id);

        // อัปเดต combined bill status
        const updatedBill = await tx.order.update({
          where: { id: billId },
          data: { status: 'completed' },
        });

        console.log('💰 Debug: Updated combined bill status to completed');

        // ✅ ปรับปรุงการประมวลผล orders และปล่อยโต๊ะ
        const releasedTables: Array<{
          table_number: number;
          orders_completed: number;
        }> = [];

        // Process each table's orders
        for (const detail of combinedBill.order_details) {
          if (detail.notes && detail.notes.includes('Order IDs:')) {
            try {
              const orderIdsMatch = detail.notes.match(/Order IDs: ([\d,]+)/);
              const tableNumberMatch = detail.notes.match(/Table (\d+)/);

              if (orderIdsMatch && tableNumberMatch) {
                const orderIds = orderIdsMatch[1]
                  .split(',')
                  .map((id) => parseInt(id.trim()));
                const tableNumber = parseInt(tableNumberMatch[1]);

                console.log(
                  `💰 Debug: Processing table ${tableNumber} with orders:`,
                  orderIds,
                );

                // สร้าง payment สำหรับแต่ละ order โดยไม่ใช้ external service
                for (const orderId of orderIds) {
                  try {
                    const order = await tx.order.findUnique({
                      where: { id: orderId },
                    });

                    if (order) {
                      // สร้าง payment record โดยตรงใน transaction
                      await tx.payment.create({
                        data: {
                          order_id: orderId,
                          payment_id: BigInt(Date.now() + Math.random() * 1000),
                          amount: order.total_price,
                          method: paymentMethod || 'cash',
                          status: 'completed',
                          payment_date: new Date(),
                          notes: `ຊຳລະຜ່ານບິນລວມ #${combinedBill.order_id}`,
                          transaction_reference: `CB_${combinedBill.order_id}_${orderId}`,
                        },
                      });

                      // อัปเดต order status เป็น completed
                      await tx.order.update({
                        where: { id: orderId },
                        data: { status: 'completed' },
                      });

                      console.log(
                        `💰 Debug: Completed payment for order ${order.order_id}`,
                      );
                    }
                  } catch (orderError) {
                    console.error(
                      `❌ Error processing order ${orderId}:`,
                      orderError,
                    );
                    // ไม่ throw error เพื่อไม่ให้หยุด transaction
                    // แต่ log เพื่อ debug
                  }
                }

                // ✅ ปล่อยโต๊ะ
                try {
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

                    console.log(`💰 Debug: Released table ${tableNumber}`);

                    releasedTables.push({
                      table_number: tableNumber,
                      orders_completed: orderIds.length,
                    });
                  }
                } catch (tableError) {
                  console.error(
                    `❌ Error releasing table ${tableNumber}:`,
                    tableError,
                  );
                  // ไม่ throw error
                }
              }
            } catch (detailError) {
              console.error(`❌ Error processing detail:`, detailError);
              // ไม่ throw error
            }
          }
        }

        return { payment, updatedBill, releasedTables };
      },
      {
        timeout: 30000, // 30 วินาที timeout
      },
    );

    console.log('💰 Debug: Payment transaction completed successfully');

    return {
      success: true,
      message: 'ຊຳລະບິນລວມສຳເລັດ',
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
    console.log(
      '💰 Debug: Processing split payment for combined bill:',
      billId,
    );

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
      throw new NotFoundException('ບໍ່ພົບບິນລວມທີ່ລະບຸ');
    }

    if (combinedBill.status === 'completed') {
      throw new ConflictException('บิลรวมนี้ชำระเงินแล้ว');
    }

    // ✅ ตรวจสอบว่าผลรวมของ split เท่ากับยอดรวม
    const totalSplitAmount = splitBillDto.splits.reduce(
      (sum, split) => sum + split.amount,
      0,
    );

    if (Math.abs(totalSplitAmount - combinedBill.total_price) > 0.01) {
      throw new BadRequestException(
        `ຍອດແບ່ງຈ່າຍ (₭${totalSplitAmount.toLocaleString()}) ບໍ່ເທົ່າກັບຍອດລວມ (₭${combinedBill.total_price.toLocaleString()})`,
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      console.log('💰 Debug: Starting split payment transaction');

      const splitPayments: any[] = []; // ✅ แก้ไข: กำหนด type ชัดเจน
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
            notes: `ແບ່ງຈ່າຍໂຕະ ${split.table_id}${splitBillDto.notes ? ` - ${splitBillDto.notes}` : ''}`,
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

            console.log(
              `💰 Debug: Processing split payment for table ${split.table_id}`,
            );

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
                    notes: `ແບ່ງຈ່າຍຈາກບິນລວມ #${combinedBill.order_id}`,
                    transaction_reference: `SPLIT_${combinedBill.order_id}_T${split.table_id}`,
                  },
                });

                await tx.order.update({
                  where: { id: orderId },
                  data: { status: 'completed' },
                });
              }
            }

            // ✅ ปล่อยโต๊ะ
            await tx.table.update({
              where: { id: split.table_id },
              data: {
                status: 'available',
                current_session_start: null,
                expected_end_time: null,
              },
            });

            console.log(
              `💰 Debug: Released table ${split.table_id} after split payment`,
            );

            handledTables.add(split.table_id);
          }
        }
      }

      // ✅ อัปเดต combined bill
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

    console.log('💰 Debug: Split payment transaction completed successfully');

    return {
      success: true,
      message: 'ແບ່ງຈ່າຍບິນລວມສຳເລັດ',
      total_amount: totalSplitAmount,
      split_payments: result.splitPayments.map((payment: any) => ({
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
    console.log('📋 Debug: Getting combined bill details:', billId);

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
      throw new NotFoundException('ບໍ່ພົບບິນລວມທີ່ລະບຸ');
    }

    // ✅ ดึงรายละเอียด orders สำหรับแต่ละโต๊ะ
    const tableDetails: any[] = []; // ✅ แก้ไข: กำหนด type ชัดเจน
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
                  food_menu: {
                    select: {
                      id: true,
                      name: true,
                      price: true,
                      image: true,
                      category: { select: { name: true } },
                    },
                  },
                  beverage_menu: {
                    select: {
                      id: true,
                      name: true,
                      hot_price: true,
                      ice_price: true,
                      image: true,
                      category: { select: { name: true } },
                    },
                  },
                },
              },
              user: {
                select: {
                  id: true,
                  first_name: true,
                  last_name: true,
                  phone: true,
                  email: true,
                },
              },
              promotion: {
                select: {
                  id: true,
                  name: true,
                  discount_type: true,
                  discount_value: true,
                },
              },
              payments: true,
            },
          });

          tableDetails.push({
            table_id: detail.id, // ใช้ detail id เป็น reference
            table_number: tableNumber,
            subtotal: detail.price,
            orders_count: orders.length,
            orders: orders.map((order) => ({
              id: order.id,
              order_id: order.order_id,
              total_price: order.total_price,
              discount_amount: order.discount_amount || 0,
              status: order.status,
              created_at: order.create_at,
              customer_info: {
                name: order.user
                  ? `${order.user.first_name || ''} ${order.user.last_name || ''}`.trim()
                  : 'ລູກຄ້າທົ່ວໄປ',
                phone: order.user?.phone || null,
                email: order.user?.email || null,
              },
              promotion: order.promotion
                ? {
                    name: order.promotion.name,
                    discount_type: order.promotion.discount_type,
                    discount_value: order.promotion.discount_value,
                  }
                : null,
              items: order.order_details.map((orderDetail) => ({
                id: orderDetail.id,
                name:
                  orderDetail.food_menu?.name ||
                  orderDetail.beverage_menu?.name ||
                  'ບໍ່ລະບຸຊື່',
                category:
                  orderDetail.food_menu?.category?.name ||
                  orderDetail.beverage_menu?.category?.name ||
                  'ອື່ນໆ',
                quantity: orderDetail.quantity,
                unit_price: orderDetail.price,
                total_price: orderDetail.quantity * orderDetail.price,
                notes: orderDetail.notes || '',
                type: orderDetail.food_menu ? 'food' : 'beverage',
                menu_image:
                  orderDetail.food_menu?.image ||
                  orderDetail.beverage_menu?.image ||
                  null,
                is_ready: orderDetail.is_ready,
              })),
            })),
          });
        }
      }
    }

    console.log('📋 Debug: Retrieved combined bill with table details');

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
        status: payment.status,
      })),
      summary: {
        tables_count: tableDetails.length,
        total_payments: combinedBill.payments.length,
        is_split_payment: combinedBill.payments.length > 1,
        payment_status: combinedBill.status,
        total_orders: tableDetails.reduce(
          // eslint-disable-next-line @typescript-eslint/no-unsafe-return
          (sum, table) => sum + table.orders_count,
          0,
        ),
        total_items: tableDetails.reduce(
          (sum, table) =>
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
            sum +
            table.orders.reduce(
              // eslint-disable-next-line @typescript-eslint/no-unsafe-return
              (orderSum, order) => orderSum + order.items.length,
              0,
            ),
          0,
        ),
      },
    };
  }

  async getAllCombinedBills(status?: string) {
    console.log('📋 Debug: Getting all combined bills, status filter:', status);

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

    console.log(`📋 Debug: Found ${bills.length} combined bills`);

    return bills.map((bill) => {
      // นับโต๊ะจาก order_details
      const tablesCount = bill.order_details.length;
      const tableNumbers = bill.order_details
        .map((detail) => {
          const match = detail.notes?.match(/Table (\d+)/);
          return match ? parseInt(match[1]) : null;
        })
        .filter((num) => num !== null)
        .sort((a, b) => a - b);

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
        // ✅ เพิ่มข้อมูลสำหรับ UI
        can_pay: bill.status === 'pending_payment',
        can_cancel: bill.status === 'pending_payment',
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
      cancelled_bills: bills.filter((bill) => bill.status === 'cancelled')
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
    console.log('❌ Debug: Cancelling combined bill:', billId);

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
      throw new NotFoundException('ບໍ່ພົບບິນລວມທີ່ລະບຸ');
    }

    if (combinedBill.status === 'completed') {
      throw new ConflictException('ບໍ່ສາມາດຍົກເລີກບິນທີ່ຊຳລະເງິນແລ້ວ');
    }

    await this.prisma.order.update({
      where: { id: billId },
      data: {
        status: 'cancelled',
        preparation_notes: combinedBill.preparation_notes
          ? `${combinedBill.preparation_notes} | ຍົກເລີກ: ${reason || 'ບໍ່ລະບຸເຫດຜົນ'}`
          : `ຍົກເລີກ: ${reason || 'ບໍ່ລະບຸເຫດຜົນ'}`,
      },
    });

    console.log('❌ Debug: Combined bill cancelled successfully');

    return {
      success: true,
      message: 'ຍົກເລີກບິນລວມສຳເລັດ',
      bill_id: combinedBill.order_id,
      reason: reason || 'ບໍ່ລະບຸເຫດຜົນ',
      cancelled_at: new Date().toISOString(),
    };
  }

  // ✅ เพิ่ม helper methods สำหรับ debugging
  async debugTableOrders(tableId: number) {
    const table = await this.prisma.table.findUnique({
      where: { id: tableId },
      include: {
        orders: {
          include: {
            payments: true,
            order_details: {
              include: {
                food_menu: { select: { name: true } },
                beverage_menu: { select: { name: true } },
              },
            },
          },
        },
      },
    });

    if (!table) {
      throw new NotFoundException(`Table ${tableId} not found`);
    }

    return {
      table_id: tableId,
      table_number: table.number,
      status: table.status,
      current_session_start: table.current_session_start,
      expected_end_time: table.expected_end_time,
      orders: table.orders.map((order) => ({
        id: order.id,
        order_id: order.order_id,
        status: order.status,
        total_price: order.total_price,
        created_at: order.create_at,
        payments: order.payments.map((p) => ({
          id: p.id,
          amount: p.amount,
          status: p.status,
          method: p.method,
          payment_date: p.payment_date,
        })),
        total_paid: order.payments
          .filter((p) => p.status === 'completed')
          .reduce((sum, p) => sum + p.amount, 0),
        is_fully_paid:
          order.payments
            .filter((p) => p.status === 'completed')
            .reduce((sum, p) => sum + p.amount, 0) >= order.total_price,
        remaining_amount:
          order.total_price -
          order.payments
            .filter((p) => p.status === 'completed')
            .reduce((sum, p) => sum + p.amount, 0),
        items: order.order_details.map((detail) => ({
          name: detail.food_menu?.name || detail.beverage_menu?.name,
          quantity: detail.quantity,
          unit_price: detail.price,
          total_price: detail.quantity * detail.price,
          is_ready: detail.is_ready,
        })),
      })),
    };
  }

  async debugCombinedBillFlow() {
    console.log('🔍 === COMBINED BILL DEBUG FLOW ===');

    try {
      // 1. ตรวจสอบโต๊ะที่มี unpaid orders
      const tablesWithUnpaid = await this.getTablesWithUnpaidOrders();
      console.log('1. Tables with unpaid orders:', tablesWithUnpaid.length);

      if (tablesWithUnpaid.length >= 2) {
        const tableIds = tablesWithUnpaid.slice(0, 2).map((t) => t.table_id);
        console.log('2. Testing preview with tables:', tableIds);

        try {
          const preview = await this.previewCombinedBill(tableIds);
          console.log('3. Preview result:', {
            tables_count: preview.tables_count,
            subtotal: preview.subtotal,
            final_amount: preview.final_amount,
            orders_count: preview.summary.total_orders,
            items_count: preview.summary.total_items,
          });

          return {
            success: true,
            message: 'Combined bill flow is working correctly',
            debug_data: {
              unpaid_tables_found: tablesWithUnpaid.length,
              test_tables: tableIds,
              preview_summary: {
                tables_count: preview.tables_count,
                subtotal: preview.subtotal,
                service_charge: preview.service_charge,
                final_amount: preview.final_amount,
                total_orders: preview.summary.total_orders,
                total_items: preview.summary.total_items,
              },
            },
            recommendations: [
              'System is ready to create combined bills',
              'Tables have unpaid orders available for billing',
              'Preview calculation is working correctly',
            ],
          };
        } catch (error) {
          console.error('3. Preview failed:', error.message);
          return {
            success: false,
            error: error.message,
            debug_data: {
              unpaid_tables_found: tablesWithUnpaid.length,
              test_tables: tableIds,
              error_step: 'preview_combined_bill',
            },
            recommendations: [
              'Check if selected tables have valid unpaid orders',
              'Verify order status and payment records',
              'Review table and order relationships',
            ],
          };
        }
      } else {
        console.log('2. Not enough tables with unpaid orders for testing');
        return {
          success: false,
          error: 'Not enough unpaid orders for testing',
          debug_data: {
            unpaid_tables_found: tablesWithUnpaid.length,
            required_minimum: 2,
          },
          recommendations: [
            'Create some test orders with "completed" or "ready" status',
            'Ensure orders have not been fully paid',
            'Check table occupancy status',
          ],
        };
      }
    } catch (error) {
      console.error('Debug flow failed:', error.message);
      return {
        success: false,
        error: error.message,
        debug_data: {
          error_step: 'get_tables_with_unpaid_orders',
        },
        recommendations: [
          'Check database connectivity',
          'Verify table and order table schemas',
          'Review Prisma configuration',
        ],
      };
    }
  }

  // ✅ เพิ่ม health check method
  async healthCheck() {
    try {
      // ตรวจสอบการเชื่อมต่อฐานข้อมูล
      await this.prisma.$queryRaw`SELECT 1`;

      // ตรวจสอบข้อมูลพื้นฐาน
      const tablesCount = await this.prisma.table.count();
      const ordersCount = await this.prisma.order.count();
      const combinedBillsCount = await this.prisma.order.count({
        where: { order_type: 'combined_bill' },
      });

      const tablesWithUnpaid = await this.getTablesWithUnpaidOrders();

      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        database_connection: 'OK',
        data: {
          total_tables: tablesCount,
          total_orders: ordersCount,
          combined_bills: combinedBillsCount,
          tables_with_unpaid_orders: tablesWithUnpaid.length,
        },
        features: {
          get_unpaid_tables: 'Available',
          preview_combined_bill: 'Available',
          create_combined_bill: 'Available',
          payment_processing: 'Available',
          split_payment: 'Available',
        },
        message: 'Combined Bills service is fully operational',
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        database_connection: 'ERROR',
        error: error.message,
        message: 'Combined Bills service has issues',
      };
    }
  }

  // ✅ เพิ่ม method สำหรับ reset table status (สำหรับ testing)
  async resetTableForTesting(tableId: number) {
    console.log(`🧪 Debug: Resetting table ${tableId} for testing`);

    const table = await this.prisma.table.findUnique({
      where: { id: tableId },
    });

    if (!table) {
      throw new NotFoundException(`Table ${tableId} not found`);
    }

    await this.prisma.table.update({
      where: { id: tableId },
      data: {
        status: 'available',
        current_session_start: null,
        expected_end_time: null,
      },
    });

    console.log(`🧪 Debug: Table ${table.number} reset to available status`);

    return {
      success: true,
      message: `Table ${table.number} reset successfully`,
      table: {
        id: tableId,
        number: table.number,
        status: 'available',
      },
    };
  }
}
