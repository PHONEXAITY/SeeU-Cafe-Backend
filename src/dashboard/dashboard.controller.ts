import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import {
  DashboardStatsResponse,
  SalesAnalyticsResponse,
  TrendingProductItem,
  RevenueChartResponse,
  CustomerMapResponse,
  RecentOrderItem,
  SummaryCardsResponse,
} from './dto/dashboard-response.dto';

@ApiTags('Dashboard')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  private buildDateFilter(
    dateStart?: string,
    dateEnd?: string,
  ): Record<string, any> {
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

    return dateFilter;
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get comprehensive dashboard statistics' })
  @ApiQuery({
    name: 'dateStart',
    required: false,
    description: 'Filter by start date (YYYY-MM-DD)',
    type: String,
  })
  @ApiQuery({
    name: 'dateEnd',
    required: false,
    description: 'Filter by end date (YYYY-MM-DD)',
    type: String,
  })
  @ApiQuery({
    name: 'timeRange',
    required: false,
    description: 'Specific time range (today, week, month, year)',
    type: String,
    enum: ['today', 'week', 'month', 'year'],
    default: 'today',
  })
  @ApiResponse({
    status: 200,
    description: 'Dashboard statistics',
    type: DashboardStatsResponse,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getDashboardStats(
    @Query('dateStart') dateStart?: string,
    @Query('dateEnd') dateEnd?: string,
    @Query('timeRange') timeRange: string = 'today',
  ): Promise<DashboardStatsResponse> {
    return this.dashboardService.getDashboardStats(
      dateStart,
      dateEnd,
      timeRange,
    );
  }

  @Get('sales-analytics')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get sales analytics data' })
  @ApiQuery({
    name: 'timeRange',
    required: false,
    description: 'Time range (today, week, month, year)',
    type: String,
    enum: ['today', 'week', 'month', 'year'],
    default: 'today',
  })
  @ApiQuery({
    name: 'dateStart',
    required: false,
    description: 'Filter by start date (YYYY-MM-DD)',
    type: String,
  })
  @ApiQuery({
    name: 'dateEnd',
    required: false,
    description: 'Filter by end date (YYYY-MM-DD)',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'Sales analytics data',
    type: SalesAnalyticsResponse,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getSalesAnalytics(
    @Query('timeRange') timeRange: string = 'today',
    @Query('dateStart') dateStart?: string,
    @Query('dateEnd') dateEnd?: string,
  ): Promise<SalesAnalyticsResponse> {
    const dateFilter = this.buildDateFilter(dateStart, dateEnd);
    return this.dashboardService.getSalesAnalytics(timeRange, dateFilter);
  }

  @Get('trending-products')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get trending products' })
  @ApiQuery({
    name: 'category',
    required: false,
    description: 'Product category (coffee, food, etc.)',
    type: String,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of products to return',
    type: Number,
    default: 5,
  })
  @ApiQuery({
    name: 'dateStart',
    required: false,
    description: 'Filter by start date (YYYY-MM-DD)',
    type: String,
  })
  @ApiQuery({
    name: 'dateEnd',
    required: false,
    description: 'Filter by end date (YYYY-MM-DD)',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'Trending products data',
    type: [TrendingProductItem],
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getTrendingProducts(
    @Query('category') category?: string,
    @Query('limit') limit: number = 5,
    @Query('dateStart') dateStart?: string,
    @Query('dateEnd') dateEnd?: string,
  ): Promise<TrendingProductItem[]> {
    const dateFilter = this.buildDateFilter(dateStart, dateEnd);
    return this.dashboardService.getTrendingProducts(
      category,
      limit,
      dateFilter,
    );
  }

  @Get('revenue-chart')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get revenue chart data' })
  @ApiQuery({
    name: 'period',
    required: false,
    description: 'Period (daily, weekly, monthly, yearly)',
    type: String,
    enum: ['daily', 'weekly', 'monthly', 'yearly'],
    default: 'monthly',
  })
  @ApiQuery({
    name: 'dateStart',
    required: false,
    description: 'Filter by start date (YYYY-MM-DD)',
    type: String,
  })
  @ApiQuery({
    name: 'dateEnd',
    required: false,
    description: 'Filter by end date (YYYY-MM-DD)',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'Revenue chart data',
    type: RevenueChartResponse,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getRevenueChart(
    @Query('period') period: string = 'monthly',
    @Query('dateStart') dateStart?: string,
    @Query('dateEnd') dateEnd?: string,
  ): Promise<RevenueChartResponse> {
    const dateFilter = this.buildDateFilter(dateStart, dateEnd);
    return this.dashboardService.getRevenueChart(period, dateFilter);
  }

  @Get('customer-map')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get customer map data' })
  @ApiQuery({
    name: 'period',
    required: false,
    description: 'Period (daily, weekly, monthly)',
    type: String,
    enum: ['daily', 'weekly', 'monthly'],
    default: 'monthly',
  })
  @ApiQuery({
    name: 'dateStart',
    required: false,
    description: 'Filter by start date (YYYY-MM-DD)',
    type: String,
  })
  @ApiQuery({
    name: 'dateEnd',
    required: false,
    description: 'Filter by end date (YYYY-MM-DD)',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'Customer map data',
    type: CustomerMapResponse,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getCustomerMap(
    @Query('period') period: string = 'monthly',
    @Query('dateStart') dateStart?: string,
    @Query('dateEnd') dateEnd?: string,
  ): Promise<CustomerMapResponse> {
    const dateFilter = this.buildDateFilter(dateStart, dateEnd);
    return this.dashboardService.getCustomerMap(period, dateFilter);
  }

  @Get('recent-orders')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get recent orders' })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of orders to return',
    type: Number,
    default: 10,
  })
  @ApiQuery({
    name: 'dateStart',
    required: false,
    description: 'Filter by start date (YYYY-MM-DD)',
    type: String,
  })
  @ApiQuery({
    name: 'dateEnd',
    required: false,
    description: 'Filter by end date (YYYY-MM-DD)',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'Recent orders data',
    type: [RecentOrderItem],
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getRecentOrders(
    @Query('limit') limit: number = 10,
    @Query('dateStart') dateStart?: string,
    @Query('dateEnd') dateEnd?: string,
  ): Promise<RecentOrderItem[]> {
    const dateFilter = this.buildDateFilter(dateStart, dateEnd);
    return this.dashboardService.getRecentOrders(limit, dateFilter);
  }

  @Get('summary-cards')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get summary cards data' })
  @ApiQuery({
    name: 'dateStart',
    required: false,
    description: 'Filter by start date (YYYY-MM-DD)',
    type: String,
  })
  @ApiQuery({
    name: 'dateEnd',
    required: false,
    description: 'Filter by end date (YYYY-MM-DD)',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'Summary cards data',
    type: SummaryCardsResponse,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getSummaryCards(
    @Query('dateStart') dateStart?: string,
    @Query('dateEnd') dateEnd?: string,
  ): Promise<SummaryCardsResponse> {
    const dateFilter = this.buildDateFilter(dateStart, dateEnd);
    return this.dashboardService.getSummaryCards(dateFilter);
  }
}
