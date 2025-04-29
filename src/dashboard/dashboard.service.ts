import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject } from '@nestjs/common';
import { Cache } from 'cache-manager';
import {
  SalesDataPoint,
  RevenueDataPoint,
  CustomerDataPoint,
  TrendingProductItem,
  RecentOrderItem,
  SummaryCardsResponse,
  DashboardStatsResponse,
  SalesAnalyticsResponse,
  RevenueChartResponse,
  CustomerMapResponse,
} from './dto/dashboard-response.dto';

interface Order {
  id: number;
  order_id: string;
  create_at: Date;
  status: string;
  total_price: number;
  User_id?: number | null;
  user?: {
    id: number;
    email: string;
    first_name?: string | null;
    last_name?: string | null;
  } | null;
  order_details: Array<{
    id: number;
    order_id: number;
    food_menu_id?: number | null;
    beverage_menu_id?: number | null;
    quantity: number;
    price: number;
    notes?: string | null;
    food_menu?: {
      id: number;
      name: string;
      description?: string | null;
      price: number;
      category_id: number;
      image?: string | null;
      status: string;
      Created_at: Date;
      items_id?: number | null;
    } | null;
    beverage_menu?: {
      id: number;
      name: string;
      description?: string | null;
      price?: number | null;
      category_id: number;
      image?: string | null;
      status: string;
      menu_id?: number | null;
      hot_price?: number | null;
      ice_price?: number | null;
      Created_at: Date;
    } | null;
  }>;
  payments: Array<{
    id: number;
    order_id: number;
    amount: number;
    method: string;
    status: string;
    notes?: string | null;
    payment_id?: bigint;
    payment_date?: Date;
    transaction_reference?: string | null;
    delivery_id?: number | null;
  }>;
  table?: {
    id: number;
    number: number;
    capacity: number;
    status: string;
  } | null;
}

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async getDashboardStats(
    dateStart?: string,
    dateEnd?: string,
    timeRange = 'today',
  ): Promise<DashboardStatsResponse> {
    const cacheKey = `dashboard_stats:${dateStart || 'all'}:${dateEnd || 'all'}:${timeRange}`;

    try {
      const cachedData =
        await this.cacheManager.get<DashboardStatsResponse>(cacheKey);
      if (cachedData) {
        return cachedData;
      }

      const dateFilter: Record<string, any> = {};

      if (dateStart) {
        dateFilter.create_at = {
          ...dateFilter.create_at,
          gte: new Date(dateStart),
        };
      }

      if (dateEnd) {
        dateFilter.create_at = {
          ...dateFilter.create_at,
          lte: new Date(dateEnd),
        };
      }

      const [
        salesAnalytics,
        trendingProducts,
        revenueChart,
        customerMap,
        recentOrders,
        summaryCards,
      ] = await Promise.all([
        this.getSalesAnalytics(timeRange, dateFilter),
        this.getTrendingProducts('coffee', 5, dateFilter),
        this.getRevenueChart('monthly', dateFilter),
        this.getCustomerMap('monthly', dateFilter),
        this.getRecentOrders(10, dateFilter),
        this.getSummaryCards(dateFilter),
      ]);

      const result: DashboardStatsResponse = {
        salesAnalytics,
        trendingProducts,
        revenueChart,
        customerMap,
        recentOrders,
        summaryCards,
      };

      await this.cacheManager.set(cacheKey, result, 900000);

      return result;
    } catch (error) {
      throw new InternalServerErrorException('Failed to fetch dashboard stats');
      console.error('Error fetching dashboard stats:', error);
    }
  }

  async getSalesAnalytics(
    timeRange = 'today',
    dateFilter: Record<string, any> = {},
  ): Promise<SalesAnalyticsResponse> {
    try {
      const timeRangeFilter = this.getTimeRangeFilter(timeRange);
      const filter = { ...dateFilter, ...timeRangeFilter };

      const orders = await this.prisma.order.findMany({
        where: filter,
        include: {
          order_details: true,
          user: {
            select: {
              id: true,
              email: true,
              first_name: true,
              last_name: true,
            },
          },
        },
        orderBy: {
          create_at: 'asc',
        },
      });

      const typedOrders = orders as unknown as Order[];

      let salesData: SalesDataPoint[];

      switch (timeRange) {
        case 'today':
          salesData = this.processSalesDataByHours(typedOrders);
          break;
        case 'week':
          salesData = this.processSalesDataByDays(typedOrders);
          break;
        case 'month':
          salesData = this.processSalesDataByDates(typedOrders);
          break;
        case 'year':
          salesData = this.processSalesDataByMonths(typedOrders);
          break;
        default:
          salesData = this.processSalesDataByHours(typedOrders);
      }

      const totalSales = typedOrders.reduce(
        (sum, order) => sum + (order.total_price || 0),
        0,
      );
      const totalCustomers = new Set(
        typedOrders.map((order) => order.User_id).filter(Boolean),
      ).size;
      const averageOrderValue =
        typedOrders.length > 0 ? totalSales / typedOrders.length : 0;

      const previousPeriodOrders = await this.getPreviousPeriodOrders(
        timeRange,
        dateFilter,
      );
      const previousTotalSales = previousPeriodOrders.reduce(
        (sum, order) => sum + (order.total_price || 0),
        0,
      );
      const salesGrowth =
        previousTotalSales > 0
          ? ((totalSales - previousTotalSales) / previousTotalSales) * 100
          : 0;

      return {
        salesData,
        totals: {
          sales: totalSales,
          customers: totalCustomers,
          averageOrder: averageOrderValue,
        },
        salesGrowth,
      };
    } catch (error) {
      throw new InternalServerErrorException('Failed to fetch sales analytics');
      console.error('Error fetching sales analytics:', error);
    }
  }

  async getTrendingProducts(
    category?: string,
    limit = 5,
    dateFilter: Record<string, any> = {},
  ): Promise<TrendingProductItem[]> {
    try {
      // Build cache key
      const cacheKey = `trending_products:${category || 'all'}:${limit}:${JSON.stringify(dateFilter)}`;
      const cachedData =
        await this.cacheManager.get<TrendingProductItem[]>(cacheKey);
      if (cachedData) {
        console.log(`Cache hit for trending products: ${cacheKey}`);
        return cachedData;
      }

      // Initialize filter
      const filter: Record<string, any> = { ...dateFilter };

      // Apply category filter if provided
      if (category) {
        const categoryFilter = await this.prisma.menuCategory.findFirst({
          where: {
            name: {
              contains: category,
              mode: 'insensitive',
            },
            type: 'beverage',
          },
        });

        if (!categoryFilter) {
          console.warn(`No category found for: ${category}`);
          return []; // Return empty array if category doesn't exist
        }

        filter.order_details = {
          some: {
            beverage_menu: {
              category_id: categoryFilter.id,
            },
          },
        };
      }

      // Fetch orders with order details
      const orders = await this.prisma.order.findMany({
        where: filter,
        include: {
          order_details: {
            include: {
              food_menu: true,
              beverage_menu: true,
            },
          },
        },
      });

      console.log(`Fetched ${orders.length} orders`);

      const productMap = new Map<number, TrendingProductItem>();

      orders.forEach((order) => {
        order.order_details.forEach((detail) => {
          const product = detail.beverage_menu || detail.food_menu;
          if (!product) {
            console.warn(`No product found for order detail ID: ${detail.id}`);
            return;
          }

          const productId = product.id;
          let price = 0;

          if (detail.food_menu) {
            price = detail.food_menu.price || 0;
          } else if (detail.beverage_menu) {
            price =
              detail.beverage_menu.price ||
              detail.beverage_menu.hot_price ||
              detail.beverage_menu.ice_price ||
              0;
          }

          if (!productMap.has(productId)) {
            productMap.set(productId, {
              id: productId,
              name: product.name,
              price,
              image_url: product.image || null,
              orders: 0,
              quantity: 0,
              revenue: 0,
              rating: 0, // Adjust if ratings are available
            });
          }

          const productData = productMap.get(productId)!;
          productData.orders += 1;
          productData.quantity += detail.quantity || 1;
          productData.revenue += (detail.price || price) * detail.quantity;
        });
      });

      const trendingProducts = Array.from(productMap.values())
        .sort((a, b) => b.orders - a.orders)
        .slice(0, limit);

      console.log(`Returning ${trendingProducts.length} trending products`);

      // Cache the result
      await this.cacheManager.set(cacheKey, trendingProducts, 300000); // 5 minutes TTL

      return trendingProducts;
    } catch (error) {
      console.error('Error in getTrendingProducts:', {
        message: error.message,
        stack: error.stack,
        category,
        limit,
        dateFilter,
      });
      throw new InternalServerErrorException(
        `Failed to fetch trending products: ${error.message}`,
      );
    }
  }

  async getRevenueChart(
    period = 'monthly',
    dateFilter: Record<string, any> = {},
  ): Promise<RevenueChartResponse> {
    try {
      const orders = await this.prisma.order.findMany({
        where: dateFilter,
        include: {
          payments: true,
        },
        orderBy: {
          create_at: 'asc',
        },
      });

      const typedOrders = orders as unknown as Order[];

      let chartData: RevenueDataPoint[];

      switch (period) {
        case 'daily':
          chartData = this.processRevenueByHours(typedOrders);
          break;
        case 'weekly':
          chartData = this.processRevenueByDays(typedOrders);
          break;
        case 'monthly':
          chartData = this.processRevenueByDates(typedOrders);
          break;
        case 'yearly':
          chartData = this.processRevenueByMonths(typedOrders);
          break;
        default:
          chartData = this.processRevenueByMonths(typedOrders);
      }

      const totalRevenue = typedOrders.reduce(
        (sum, order) => sum + (order.total_price || 0),
        0,
      );

      const estimatedExpenseRatio = Math.random() * 0.3 + 0.3;
      const totalExpense = totalRevenue * estimatedExpenseRatio;

      return {
        chartData,
        summary: {
          totalRevenue,
          totalExpense,
          netProfit: totalRevenue - totalExpense,
        },
      };
    } catch (error) {
      throw new InternalServerErrorException('Failed to fetch revenue chart');
      console.error('Error fetching revenue chart:', error);
    }
  }

  async getCustomerMap(
    period = 'monthly',
    dateFilter: Record<string, any> = {},
  ): Promise<CustomerMapResponse> {
    try {
      const orders = await this.prisma.order.findMany({
        where: dateFilter,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              first_name: true,
              last_name: true,
            },
          },
        },
        orderBy: {
          create_at: 'asc',
        },
      });

      const typedOrders = orders as unknown as Order[];

      let chartData: CustomerDataPoint[];

      switch (period) {
        case 'daily':
          chartData = this.processCustomerDataByHours(typedOrders);
          break;
        case 'weekly':
          chartData = this.processCustomerDataByDays(typedOrders);
          break;
        case 'monthly':
          chartData = this.processCustomerDataByDates(typedOrders);
          break;
        default:
          chartData = this.processCustomerDataByDates(typedOrders);
      }

      return {
        chartData,
        summary: {
          newCustomers: this.countNewCustomers(typedOrders),
          returningCustomers: this.countReturningCustomers(typedOrders),
          totalCustomers: new Set(
            typedOrders.map((order) => order.User_id).filter(Boolean),
          ).size,
        },
      };
    } catch (error) {
      throw new InternalServerErrorException('Failed to fetch customer map');
      console.error('Error fetching customer map:', error);
    }
  }

  async getRecentOrders(
    limit = 10,
    dateFilter: Record<string, any> = {},
  ): Promise<RecentOrderItem[]> {
    try {
      const orders = await this.prisma.order.findMany({
        where: dateFilter,
        take: limit,
        orderBy: {
          create_at: 'desc',
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              first_name: true,
              last_name: true,
            },
          },
          order_details: {
            include: {
              food_menu: true,
              beverage_menu: true,
            },
          },
          payments: true,
          table: true,
        },
      });

      return orders.map((order) => {
        const mainItem = order.order_details[0];
        const product = mainItem?.food_menu || mainItem?.beverage_menu;
        const payment = order.payments[0];

        return {
          id: order.order_id,
          item: product?.name || 'Unknown Item',
          date: order.create_at.toISOString(),
          table: order.table?.number?.toString() || 'N/A',
          price: `฿${order.total_price?.toFixed(2) || '0.00'}`,
          payment: payment?.method || 'N/A',
          status: order.status,
          customer: order.user
            ? `${order.user.first_name || ''} ${order.user.last_name || ''}`.trim()
            : 'Guest',
          items: order.order_details.length,
          image_url: product?.image || null,
        };
      });
    } catch (error) {
      throw new InternalServerErrorException('Failed to fetch recent orders');
      console.error('Error fetching recent orders:', error);
    }
  }

  async getSummaryCards(
    dateFilter: Record<string, any> = {},
  ): Promise<SummaryCardsResponse> {
    try {
      const currentPeriodOrders = await this.prisma.order.findMany({
        where: dateFilter,
      });

      const users = await this.prisma.user.findMany({
        where: {
          role: {
            name: 'customer',
          },
          ...dateFilter,
        },
      });

      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

      const previousPeriodFilter = { ...dateFilter };
      if (dateFilter.create_at && dateFilter.create_at.gte) {
        const prevStart = new Date(dateFilter.create_at.gte);
        prevStart.setMonth(prevStart.getMonth() - 1);
        previousPeriodFilter.create_at = {
          ...previousPeriodFilter.create_at,
          gte: prevStart,
        };
      }
      if (dateFilter.create_at && dateFilter.create_at.lte) {
        const prevEnd = new Date(dateFilter.create_at.lte);
        prevEnd.setMonth(prevEnd.getMonth() - 1);
        previousPeriodFilter.create_at = {
          ...previousPeriodFilter.create_at,
          lte: prevEnd,
        };
      }

      const previousPeriodOrders = await this.prisma.order.findMany({
        where: previousPeriodFilter,
      });

      const previousPeriodUsers = await this.prisma.user.findMany({
        where: {
          role: {
            name: 'customer',
          },
          ...previousPeriodFilter,
        },
      });

      const currentTotalOrders = currentPeriodOrders.length;
      const currentTotalCustomers = users.length;
      const currentTotalRevenue = currentPeriodOrders.reduce(
        (sum, order) => sum + (order.total_price || 0),
        0,
      );

      const previousTotalOrders = previousPeriodOrders.length;
      const previousTotalCustomers = previousPeriodUsers.length;
      const previousTotalRevenue = previousPeriodOrders.reduce(
        (sum, order) => sum + (order.total_price || 0),
        0,
      );

      const orderChange = this.calculatePercentChange(
        currentTotalOrders,
        previousTotalOrders,
      );
      const customerChange = this.calculatePercentChange(
        currentTotalCustomers,
        previousTotalCustomers,
      );
      const revenueChange = this.calculatePercentChange(
        currentTotalRevenue,
        previousTotalRevenue,
      );

      return {
        orders: {
          value: currentTotalOrders,
          change: orderChange,
        },
        customers: {
          value: currentTotalCustomers,
          change: customerChange,
        },
        revenue: {
          value: currentTotalRevenue,
          change: revenueChange,
        },
      };
    } catch (error) {
      throw new InternalServerErrorException('Failed to fetch summary cards');
      console.error('Error fetching summary cards:', error);
    }
  }

  private getTimeRangeFilter(timeRange: string): Record<string, any> {
    const now = new Date();
    const filter: Record<string, any> = {};

    switch (timeRange) {
      case 'today': {
        const startOfToday = new Date(now);
        startOfToday.setHours(0, 0, 0, 0);

        filter.create_at = {
          gte: startOfToday,
          lte: now,
        };
        break;
      }
      case 'week': {
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        startOfWeek.setHours(0, 0, 0, 0);

        filter.create_at = {
          gte: startOfWeek,
          lte: now,
        };
        break;
      }
      case 'month': {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        filter.create_at = {
          gte: startOfMonth,
          lte: now,
        };
        break;
      }
      case 'year': {
        const startOfYear = new Date(now.getFullYear(), 0, 1);

        filter.create_at = {
          gte: startOfYear,
          lte: now,
        };
        break;
      }
      default: {
        const defaultStart = new Date(now);
        defaultStart.setHours(0, 0, 0, 0);

        filter.create_at = {
          gte: defaultStart,
          lte: now,
        };
      }
    }

    return filter;
  }

  private async getPreviousPeriodOrders(
    timeRange: string,
    dateFilter: Record<string, any>,
  ): Promise<Order[]> {
    const now = new Date();
    const previousPeriodFilter: Record<string, any> = { ...dateFilter };

    switch (timeRange) {
      case 'today': {
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        const startOfYesterday = new Date(yesterday);
        startOfYesterday.setHours(0, 0, 0, 0);
        const endOfYesterday = new Date(yesterday);
        endOfYesterday.setHours(23, 59, 59, 999);

        previousPeriodFilter.create_at = {
          gte: startOfYesterday,
          lte: endOfYesterday,
        };
        break;
      }
      case 'week': {
        const lastWeekStart = new Date(now);
        lastWeekStart.setDate(now.getDate() - now.getDay() - 7);
        lastWeekStart.setHours(0, 0, 0, 0);
        const lastWeekEnd = new Date(now);
        lastWeekEnd.setDate(now.getDate() - now.getDay() - 1);
        lastWeekEnd.setHours(23, 59, 59, 999);

        previousPeriodFilter.create_at = {
          gte: lastWeekStart,
          lte: lastWeekEnd,
        };
        break;
      }
      case 'month': {
        const lastMonthStart = new Date(
          now.getFullYear(),
          now.getMonth() - 1,
          1,
        );
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
        lastMonthEnd.setHours(23, 59, 59, 999);

        previousPeriodFilter.create_at = {
          gte: lastMonthStart,
          lte: lastMonthEnd,
        };
        break;
      }
      case 'year': {
        const lastYearStart = new Date(now.getFullYear() - 1, 0, 1);
        const lastYearEnd = new Date(now.getFullYear() - 1, 11, 31);
        lastYearEnd.setHours(23, 59, 59, 999);

        previousPeriodFilter.create_at = {
          gte: lastYearStart,
          lte: lastYearEnd,
        };
        break;
      }
      default: {
        const defaultYesterday = new Date(now);
        defaultYesterday.setDate(defaultYesterday.getDate() - 1);
        const defaultStartOfYesterday = new Date(defaultYesterday);
        defaultStartOfYesterday.setHours(0, 0, 0, 0);
        const defaultEndOfYesterday = new Date(defaultYesterday);
        defaultEndOfYesterday.setHours(23, 59, 59, 999);

        previousPeriodFilter.create_at = {
          gte: defaultStartOfYesterday,
          lte: defaultEndOfYesterday,
        };
      }
    }

    const orders = await this.prisma.order.findMany({
      where: previousPeriodFilter,
    });

    return orders as unknown as Order[];
  }

  private processSalesDataByHours(orders: Order[]): SalesDataPoint[] {
    const hourlyData: Record<string, SalesDataPoint> = {};

    for (let i = 0; i < 24; i++) {
      const hourStr = i.toString().padStart(2, '0');
      const timeStr =
        i < 12
          ? `${hourStr}:00 AM`
          : `${i === 12 ? '12' : (i - 12).toString().padStart(2, '0')}:00 PM`;

      hourlyData[hourStr] = { time: timeStr, sales: 0, customers: 0 };
    }

    orders.forEach((order) => {
      const orderDate = new Date(order.create_at);
      const hourKey = orderDate.getHours().toString().padStart(2, '0');

      if (hourlyData[hourKey]) {
        hourlyData[hourKey].sales += order.total_price || 0;

        if (order.User_id) {
          hourlyData[hourKey].customers += 1;
        }
      }
    });

    return Object.keys(hourlyData)
      .sort()
      .map((hour) => hourlyData[hour]);
  }

  private processSalesDataByDays(orders: Order[]): SalesDataPoint[] {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dailyData: Record<string, SalesDataPoint> = {};

    dayNames.forEach((day) => {
      dailyData[day] = { time: day, sales: 0, customers: 0 };
    });

    orders.forEach((order) => {
      const orderDate = new Date(order.create_at);
      const dayKey = dayNames[orderDate.getDay()];

      if (dailyData[dayKey]) {
        dailyData[dayKey].sales += order.total_price || 0;
        if (order.User_id) {
          dailyData[dayKey].customers += 1;
        }
      }
    });

    const orderedDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return orderedDays.map((day) => dailyData[day]);
  }

  private processSalesDataByDates(orders: Order[]): SalesDataPoint[] {
    const dateData: Record<string, SalesDataPoint> = {};
    const now = new Date();

    const daysInMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
    ).getDate();
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = i.toString().padStart(2, '0');
      dateData[dateStr] = {
        time: dateStr,
        sales: 0,
        customers: 0,
        date: `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${dateStr}`,
      };
    }

    orders.forEach((order) => {
      const orderDate = new Date(order.create_at);

      if (
        orderDate.getMonth() === now.getMonth() &&
        orderDate.getFullYear() === now.getFullYear()
      ) {
        const dateKey = orderDate.getDate().toString().padStart(2, '0');

        if (dateData[dateKey]) {
          dateData[dateKey].sales += order.total_price || 0;
          if (order.User_id) {
            dateData[dateKey].customers += 1;
          }
        }
      }
    });

    const weeks: SalesDataPoint[] = [
      { time: 'Week 1', sales: 0, customers: 0 },
      { time: 'Week 2', sales: 0, customers: 0 },
      { time: 'Week 3', sales: 0, customers: 0 },
      { time: 'Week 4', sales: 0, customers: 0 },
      { time: 'Week 5', sales: 0, customers: 0 },
    ];

    Object.values(dateData).forEach((dayData, index) => {
      const weekIndex = Math.floor(index / 7);
      if (weekIndex < weeks.length) {
        weeks[weekIndex].sales += dayData.sales;
        weeks[weekIndex].customers += dayData.customers;
      }
    });

    return weeks.filter((week) => week.sales > 0 || week.customers > 0);
  }

  private processSalesDataByMonths(orders: Order[]): SalesDataPoint[] {
    const monthNames = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    const monthlyData: Record<string, SalesDataPoint> = {};

    monthNames.forEach((month) => {
      monthlyData[month] = { time: month, sales: 0, customers: 0 };
    });

    orders.forEach((order) => {
      const orderDate = new Date(order.create_at);
      const monthKey = monthNames[orderDate.getMonth()];

      if (monthlyData[monthKey]) {
        monthlyData[monthKey].sales += order.total_price || 0;
        if (order.User_id) {
          monthlyData[monthKey].customers += 1;
        }
      }
    });

    return monthNames.map((month) => monthlyData[month]);
  }

  private processRevenueByHours(orders: Order[]): RevenueDataPoint[] {
    const hourlyData: Record<string, RevenueDataPoint> = {};

    for (let i = 0; i < 24; i++) {
      const hourStr = i.toString().padStart(2, '0');
      const timeStr =
        i < 12
          ? `${hourStr}:00 AM`
          : `${i === 12 ? '12' : (i - 12).toString().padStart(2, '0')}:00 PM`;

      hourlyData[hourStr] = { name: timeStr, revenue: 0, expense: 0 };
    }

    orders.forEach((order) => {
      const orderDate = new Date(order.create_at);
      const hourKey = orderDate.getHours().toString().padStart(2, '0');

      if (hourlyData[hourKey]) {
        hourlyData[hourKey].revenue += order.total_price || 0;
      }
    });

    Object.keys(hourlyData).forEach((hour) => {
      hourlyData[hour].expense =
        hourlyData[hour].revenue * (Math.random() * 0.3 + 0.3);
    });

    return Object.keys(hourlyData)
      .sort()
      .map((hour) => hourlyData[hour]);
  }

  private processRevenueByDays(orders: Order[]): RevenueDataPoint[] {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dailyData: Record<string, RevenueDataPoint> = {};

    dayNames.forEach((day) => {
      dailyData[day] = { name: day, revenue: 0, expense: 0 };
    });

    orders.forEach((order) => {
      const orderDate = new Date(order.create_at);
      const dayKey = dayNames[orderDate.getDay()];

      if (dailyData[dayKey]) {
        dailyData[dayKey].revenue += order.total_price || 0;
      }
    });

    Object.keys(dailyData).forEach((day) => {
      dailyData[day].expense =
        dailyData[day].revenue * (Math.random() * 0.3 + 0.3);
    });

    const orderedDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return orderedDays.map((day) => dailyData[day]);
  }

  private processRevenueByDates(orders: Order[]): RevenueDataPoint[] {
    const dateData: Record<string, RevenueDataPoint> = {};
    const now = new Date();

    const daysInMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
    ).getDate();
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = i.toString().padStart(2, '0');
      dateData[dateStr] = {
        name: dateStr,
        revenue: 0,
        expense: 0,
      };
    }

    orders.forEach((order) => {
      const orderDate = new Date(order.create_at);

      if (
        orderDate.getMonth() === now.getMonth() &&
        orderDate.getFullYear() === now.getFullYear()
      ) {
        const dateKey = orderDate.getDate().toString().padStart(2, '0');

        if (dateData[dateKey]) {
          dateData[dateKey].revenue += order.total_price || 0;
        }
      }
    });

    Object.keys(dateData).forEach((date) => {
      dateData[date].expense =
        dateData[date].revenue * (Math.random() * 0.3 + 0.3);
    });

    return Object.keys(dateData)
      .sort()
      .map((date) => dateData[date]);
  }

  private processRevenueByMonths(orders: Order[]): RevenueDataPoint[] {
    const monthNames = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    const monthlyData: Record<string, RevenueDataPoint> = {};

    monthNames.forEach((month) => {
      monthlyData[month] = { name: month, revenue: 0, expense: 0 };
    });

    orders.forEach((order) => {
      const orderDate = new Date(order.create_at);
      const monthKey = monthNames[orderDate.getMonth()];

      if (monthlyData[monthKey]) {
        monthlyData[monthKey].revenue += order.total_price || 0;
      }
    });

    Object.keys(monthlyData).forEach((month) => {
      monthlyData[month].expense =
        monthlyData[month].revenue * (Math.random() * 0.3 + 0.3);
    });

    return monthNames.map((month) => monthlyData[month]);
  }

  private processCustomerDataByHours(orders: Order[]): CustomerDataPoint[] {
    const hourlyData: Record<string, CustomerDataPoint> = {};

    for (let i = 0; i < 24; i++) {
      const hourStr = i.toString().padStart(2, '0');

      hourlyData[hourStr] = {
        name: i.toString(),
        pv: 0,
        uv: 0,
      };
    }

    const customerTracker = new Map<number | string, string>();

    orders.forEach((order) => {
      if (!order.User_id) return;

      const orderDate = new Date(order.create_at);
      const hourKey = orderDate.getHours().toString().padStart(2, '0');

      const trackKey = `${order.User_id}-${hourKey}`;

      if (!customerTracker.has(order.User_id)) {
        hourlyData[hourKey].pv += 1;
        customerTracker.set(order.User_id, hourKey);
      } else if (customerTracker.get(order.User_id) !== hourKey) {
        hourlyData[hourKey].uv += 1;
        customerTracker.set(trackKey, 'true');
      }
    });

    return Object.keys(hourlyData)
      .sort()
      .map((hour) => hourlyData[hour]);
  }

  private processCustomerDataByDays(orders: Order[]): CustomerDataPoint[] {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dailyData: Record<string, CustomerDataPoint> = {};

    dayNames.forEach((day, index) => {
      dailyData[day] = {
        name: (index + 1).toString(),
        pv: 0,
        uv: 0,
      };
    });

    const customerTracker = new Map<number | string, string>();

    orders.forEach((order) => {
      if (!order.User_id) return;

      const orderDate = new Date(order.create_at);
      const dayKey = dayNames[orderDate.getDay()];

      const trackKey = `${order.User_id}-${dayKey}`;

      if (!customerTracker.has(order.User_id)) {
        dailyData[dayKey].pv += 1;
        customerTracker.set(order.User_id, dayKey);
      } else if (customerTracker.get(order.User_id) !== dayKey) {
        dailyData[dayKey].uv += 1;
        customerTracker.set(trackKey, 'true');
      }
    });

    const orderedDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return orderedDays.map((day, index) => ({
      ...dailyData[day],
      name: (index + 1).toString(),
    }));
  }

  private processCustomerDataByDates(orders: Order[]): CustomerDataPoint[] {
    const dateData: Record<string, CustomerDataPoint> = {};
    const now = new Date();

    const daysInMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
    ).getDate();
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = i.toString().padStart(2, '0');
      dateData[dateStr] = {
        name: i.toString(),
        pv: 0,
        uv: 0,
      };
    }

    const customerTracker = new Map<number | string, string>();

    orders.forEach((order) => {
      if (!order.User_id) return;

      const orderDate = new Date(order.create_at);

      if (
        orderDate.getMonth() === now.getMonth() &&
        orderDate.getFullYear() === now.getFullYear()
      ) {
        const dateKey = orderDate.getDate().toString().padStart(2, '0');

        if (dateData[dateKey]) {
          const trackKey = `${order.User_id}-${dateKey}`;

          if (!customerTracker.has(order.User_id)) {
            dateData[dateKey].pv += 1;
            customerTracker.set(order.User_id, dateKey);
          } else if (customerTracker.get(order.User_id) !== dateKey) {
            dateData[dateKey].uv += 1;
            customerTracker.set(trackKey, 'true');
          }
        }
      }
    });

    return Object.keys(dateData)
      .sort()
      .slice(0, 7)
      .map((date) => dateData[date]);
  }

  private countNewCustomers(orders: Order[]): number {
    const customerCounts = new Map<number, number>();

    orders.forEach((order) => {
      if (!order.User_id) return;

      const count = customerCounts.get(order.User_id) || 0;
      customerCounts.set(order.User_id, count + 1);
    });

    return Array.from(customerCounts.values()).filter((count) => count === 1)
      .length;
  }

  private countReturningCustomers(orders: Order[]): number {
    const customerCounts = new Map<number, number>();

    orders.forEach((order) => {
      if (!order.User_id) return;

      const count = customerCounts.get(order.User_id) || 0;
      customerCounts.set(order.User_id, count + 1);
    });

    return Array.from(customerCounts.values()).filter((count) => count > 1)
      .length;
  }

  private calculatePercentChange(current: number, previous: number): number {
    if (previous === 0) {
      return current > 0 ? 100 : 0;
    }
    return ((current - previous) / previous) * 100;
  }
}
