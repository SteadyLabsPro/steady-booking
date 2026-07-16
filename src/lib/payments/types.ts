/**
 * Provider-agnostic payment contracts. The booking system speaks only in these
 * internal states and shapes; the Stripe adapter (stripe.ts) maps to/from them.
 */

export type PaymentStatus =
  | "pending"
  | "paid"
  | "failed"
  | "refunded"
  | "cancelled"
  | "complimentary";

export interface CheckoutParams {
  bookingId: string;
  amountMinor: number;
  currency: string;
  customerEmail: string;
  description: string;
  successUrl: string;
  cancelUrl: string;
  /** Card statement descriptor suffix (e.g. "TIDEHOUSE"). */
  statementDescriptor?: string;
  /** Extra metadata merged onto the session (e.g. { business: "tidehouse" }). */
  metadata?: Record<string, string>;
}

export interface CheckoutResult {
  /** Hosted checkout URL to redirect the customer to. */
  url: string;
  /** Provider reference stored on the booking to correlate webhooks. */
  ref: string;
}

/** An internal update derived from a provider webhook event. */
export interface PaymentUpdate {
  /** Provider reference to find the booking (matches booking.payment_ref). */
  ref: string;
  paymentStatus: PaymentStatus;
  /** Whether this event should also confirm the booking. */
  confirmBooking: boolean;
  /** PaymentIntent id, stored so a later refund can be matched to the booking. */
  paymentIntentId?: string | null;
}

/** A refund derived from a provider webhook, matched by PaymentIntent. */
export interface RefundInfo {
  paymentIntentId: string;
  amountRefundedMinor: number;
  chargeAmountMinor: number;
  fullyRefunded: boolean;
}
