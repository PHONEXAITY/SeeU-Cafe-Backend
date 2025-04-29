export interface Order {
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

export interface SalesDataPoint {
  time: string;
  sales: number;
  customers: number;
  date?: string;
}

export interface RevenueDataPoint {
  name: string;
  revenue: number;
  expense: number;
}

export interface CustomerDataPoint {
  name: string;
  pv: number;
  uv: number;
}

export interface SalesAnalyticsResponse {
  salesData: SalesDataPoint[];
  totals: {
    sales: number;
    customers: number;
    averageOrder: number;
  };
  salesGrowth: number;
}

export interface TrendingProductsResponse {
  id: number;
  name: string;
  price: number;
  image_url: string | null;
  orders: number;
  quantity: number;
  revenue: number;
  rating: number;
}

export interface RevenueChartResponse {
  chartData: RevenueDataPoint[];
  summary: {
    totalRevenue: number;
    totalExpense: number;
    netProfit: number;
  };
}

export interface CustomerMapResponse {
  chartData: CustomerDataPoint[];
  summary: {
    newCustomers: number;
    returningCustomers: number;
    totalCustomers: number;
  };
}

export interface RecentOrderResponse {
  id: string;
  item: string;
  date: string;
  table: string;
  price: string;
  payment: string;
  status: string;
  customer: string;
  items: number;
  image_url: string | null;
}

export interface SummaryCardsResponse {
  orders: {
    value: number;
    change: number;
  };
  customers: {
    value: number;
    change: number;
  };
  revenue: {
    value: number;
    change: number;
  };
}

export interface DashboardStatsResponse {
  data: {
    salesAnalytics: SalesAnalyticsResponse;
    trendingProducts: TrendingProductsResponse[];
    revenueChart: RevenueChartResponse;
    customerMap: CustomerMapResponse;
    recentOrders: RecentOrderResponse[];
    summaryCards: SummaryCardsResponse;
  };
}
