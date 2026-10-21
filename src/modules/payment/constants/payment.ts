export const PAYMENT_EVENTS = {
  COMPLETED: 'payment.completed',
} as const;

export interface PaymentCompletedPayload {
  transactionId: string;
  bookingId: string;
  payerId: string;
  landlordId: string;
  amount: number;
  purpose: 'deposit' | 'rent';
}
