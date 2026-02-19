

// Request status
export enum RequestStatus {
  PENDING = "pending",
  APPROVED = "approved",
  REJECTED = "rejected",
  DISPATCHED = "dispatched",
  RECEIVED = "received",
  COMPLETED = "completed"
}

// Exchange status
export enum ExchangeStatus {
  PENDING = "pending",
  APPROVED = "approved",
  REJECTED = "rejected",
  COMPLETED = "completed",
  CANCELLED = "cancelled"
}

// Exchange type
export enum ExchangeType {
  DAMAGE = "damage",
  NORMAL = "normal"
}

// Invoice type
export enum InvoiceType {
  NORMAL = "normal",
  EXCHANGE = "exchange"
}


// Stock balance direction
export enum BalanceDirection {
  REFUND_TO_CUSTOMER = "refund_to_customer",
  CUSTOMER_PAYS = "customer_pays",
  EVEN = "even"
}

// Payment methods
export enum PaymentMethod {
  CASH = "cash",
  RAZORPAY = "razorpay"
}



