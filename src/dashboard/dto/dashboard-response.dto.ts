import { ApiProperty } from '@nestjs/swagger';

export class SalesDataPoint {
  @ApiProperty({ example: '09:00 AM' })
  time: string;

  @ApiProperty({ example: 1200 })
  sales: number;

  @ApiProperty({ example: 12 })
  customers: number;

  @ApiProperty({ example: '2023-04-26', required: false })
  date?: string;
}

export class RevenueDataPoint {
  @ApiProperty({ example: 'Jan' })
  name: string;

  @ApiProperty({ example: 4000 })
  revenue: number;

  @ApiProperty({ example: 2400 })
  expense: number;
}

export class CustomerDataPoint {
  @ApiProperty({ example: '1' })
  name: string;

  @ApiProperty({ description: 'New customers', example: 4000 })
  pv: number;

  @ApiProperty({ description: 'Returning customers', example: 2400 })
  uv: number;
}

export class TrendingProductItem {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'Cappuccino' })
  name: string;

  @ApiProperty({ example: 15.99 })
  price: number;

  @ApiProperty({ example: 'https://example.com/image.jpg', nullable: true })
  image_url: string | null;

  @ApiProperty({ example: 120 })
  orders: number;

  @ApiProperty({ example: 150 })
  quantity: number;

  @ApiProperty({ example: 2400 })
  revenue: number;

  @ApiProperty({ example: 4.5 })
  rating: number;
}

export class RecentOrderItem {
  @ApiProperty({ example: 'ORD1234567' })
  id: string;

  @ApiProperty({ example: 'Cappuccino' })
  item: string;

  @ApiProperty({ example: '2023-04-26T14:30:45.123Z' })
  date: string;

  @ApiProperty({ example: '28' })
  table: string;

  @ApiProperty({ example: '$15.99' })
  price: string;

  @ApiProperty({ example: 'Cash' })
  payment: string;

  @ApiProperty({ example: 'delivered' })
  status: string;

  @ApiProperty({ example: 'John Doe' })
  customer: string;

  @ApiProperty({ example: 3 })
  items: number;

  @ApiProperty({ example: 'https://example.com/image.jpg', nullable: true })
  image_url: string | null;
}

export class SummaryCardItem {
  @ApiProperty({ example: 150 })
  value: number;

  @ApiProperty({ example: 12.5 })
  change: number;
}

export class SalesAnalyticsResponse {
  @ApiProperty({ type: [SalesDataPoint] })
  salesData: SalesDataPoint[];

  @ApiProperty({
    type: 'object',
    properties: {
      sales: { type: 'number', example: 12000 },
      customers: { type: 'number', example: 120 },
      averageOrder: { type: 'number', example: 100 },
    },
    additionalProperties: false,
  })
  totals: {
    sales: number;
    customers: number;
    averageOrder: number;
  };

  @ApiProperty({ example: 15.2 })
  salesGrowth: number;
}

export class RevenueChartResponse {
  @ApiProperty({ type: [RevenueDataPoint] })
  chartData: RevenueDataPoint[];

  @ApiProperty({
    type: 'object',
    properties: {
      totalRevenue: { type: 'number', example: 50000 },
      totalExpense: { type: 'number', example: 30000 },
      netProfit: { type: 'number', example: 20000 },
    },
    additionalProperties: false,
  })
  summary: {
    totalRevenue: number;
    totalExpense: number;
    netProfit: number;
  };
}

export class CustomerMapResponse {
  @ApiProperty({ type: [CustomerDataPoint] })
  chartData: CustomerDataPoint[];

  @ApiProperty({
    type: 'object',
    properties: {
      newCustomers: { type: 'number', example: 50 },
      returningCustomers: { type: 'number', example: 70 },
      totalCustomers: { type: 'number', example: 120 },
    },
    additionalProperties: false,
  })
  summary: {
    newCustomers: number;
    returningCustomers: number;
    totalCustomers: number;
  };
}

export class SummaryCardsResponse {
  @ApiProperty({ type: SummaryCardItem })
  orders: SummaryCardItem;

  @ApiProperty({ type: SummaryCardItem })
  customers: SummaryCardItem;

  @ApiProperty({ type: SummaryCardItem })
  revenue: SummaryCardItem;
}

export class DashboardStatsResponse {
  @ApiProperty({ type: SalesAnalyticsResponse })
  salesAnalytics: SalesAnalyticsResponse;

  @ApiProperty({ type: [TrendingProductItem] })
  trendingProducts: TrendingProductItem[];

  @ApiProperty({ type: RevenueChartResponse })
  revenueChart: RevenueChartResponse;

  @ApiProperty({ type: CustomerMapResponse })
  customerMap: CustomerMapResponse;

  @ApiProperty({ type: [RecentOrderItem] })
  recentOrders: RecentOrderItem[];

  @ApiProperty({ type: SummaryCardsResponse })
  summaryCards: SummaryCardsResponse;
}
