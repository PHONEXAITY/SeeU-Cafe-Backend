import { DeliveryStatus } from '../enums/delivery-status.enum';
export interface LocationHistoryEntry {
  latitude: number;
  longitude: number;
  timestamp: Date | string;
  note?: string;
  current?: boolean;
  accuracy?: number;
}

export interface DeliveryLocationInfo {
  id: number;
  order_id: number;
  customer_latitude: number | null;
  customer_longitude: number | null;
  customer_location_note: string | null;
  latitude: number | null;
  longitude: number | null;
  lastUpdate: Date | null;
  status: string;
  delivery_address: string | null;
  employee?: {
    id: number;
    first_name: string;
    last_name: string;
    phone?: string | null;
  } | null;
  order: {
    order_id: string;
    User_id: number | null;
    user?: {
      id: number;
      first_name?: string | null;
      last_name?: string | null;
    } | null;
  };
}

export interface RouteInfo {
  distance: number; // in meters
  duration: number; // in seconds
  geometry: number[][];
  eta: number; // estimated time in minutes
}

export interface DeliveryNotificationPayload {
  user_id: number;
  order_id: number;
  message: string;
  type: 'delivery_update' | 'location_update' | 'time_update';
  action_url?: string;
  read: boolean;
}

export type DeliveryWithDetails = {
  id: number;
  order_id: number;
  status: DeliveryStatus;
  delivery_id: string;
  delivery_address: string | null;
  customer_note: string | null;
  phone_number: string | null; // Added this property
  delivery_fee: number | null;
  estimated_delivery_time: Date | null;
  actual_delivery_time: Date | null;
  pickup_from_kitchen_time: Date | null;
  last_latitude: number | null;
  last_longitude: number | null;
  last_location_update: Date | null;
  location_history: any;
  notes: string | null;
  created_at: Date; // Added this property
  updated_at: Date; // Added this property
  employee_id: number | null;
  order: {
    id: number;
    order_id: string;
    User_id: number | null;
    create_at: Date;
    total_price: number;
    sub_total?: number;
    discount_amount?: number;
    user?: {
      id: number;
      email: string;
      first_name?: string | null;
      last_name?: string | null;
      phone?: string | null;
    } | null;
    order_details?: Array<{
      id: number;
      quantity: number;
      price: number;
      notes?: string | null;
      food_menu?: {
        id: number;
        name: string;
      } | null;
      beverage_menu?: {
        id: number;
        name: string;
      } | null;
    }>;
    timeline?: Array<{
      id: number;
      status: string;
      timestamp: Date;
      notes?: string | null;
      employee_id?: number | null;
    }>;
  };
  employee?: {
    id: number;
    first_name: string;
    last_name: string;
    phone?: string | null;
    profile_photo?: string | null;
  } | null;
};
