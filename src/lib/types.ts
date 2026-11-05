export type OrderStatus = "open" | "paid" | "cancelled";
export type KitchenStatus = "new" | "sent" | "ready";
export type PaymentMethod = "cash" | "card";

export interface CategoryDto {
  id: number;
  name: string;
  sortOrder: number;
  active: boolean;
  productCount?: number;
}

export interface ProductDto {
  id: number;
  name: string;
  categoryId: number;
  categoryName?: string;
  price: number;
  vatRate: number;
  active: boolean;
  createdAt: string;
}

export interface TableDto {
  id: number;
  name: string;
  seats: number;
  sortOrder: number;
  openOrder: { id: number; total: number; itemCount: number; createdAt: string } | null;
}

export interface OrderItemDto {
  id: number;
  orderId: number;
  productId: number | null;
  productName: string;
  unitPrice: number;
  vatRate: number;
  quantity: number;
  note: string | null;
  kitchenStatus: KitchenStatus;
  sentAt: string | null;
  createdAt: string;
}

export interface PaymentDto {
  id: number;
  orderId: number;
  method: PaymentMethod;
  amount: number;
  createdAt: string;
}

export interface OrderDto {
  id: number;
  receiptNo: number | null;
  tableId: number;
  tableName: string;
  status: OrderStatus;
  total: number;
  paid: number;
  createdAt: string;
  paidAt: string | null;
  items: OrderItemDto[];
  payments: PaymentDto[];
}

export interface KitchenOrderDto {
  id: number;
  tableName: string;
  status: OrderStatus;
  createdAt: string;
  items: OrderItemDto[];
}

export interface ReportLine {
  name: string;
  quantity: number;
  amount: number;
}

export interface DailyReportDto {
  date: string;
  receiptCount: number;
  totalSales: number;
  byPaymentMethod: { method: PaymentMethod; amount: number }[];
  byCategory: ReportLine[];
  topByQuantity: ReportLine[];
  topByRevenue: ReportLine[];
  vatSummary: { vatRate: number; net: number; vat: number; gross: number }[];
  byHour: { hour: number; amount: number; receipts: number }[];
}
