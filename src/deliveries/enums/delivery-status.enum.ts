export enum DeliveryStatus {
  PENDING = 'pending',
  PREPARING = 'preparing',
  OUT_FOR_DELIVERY = 'out_for_delivery',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
}

export enum DeliveryTimeType {
  ESTIMATED_DELIVERY_TIME = 'estimated_delivery_time',
  PICKUP_FROM_KITCHEN_TIME = 'pickup_from_kitchen_time',
}
