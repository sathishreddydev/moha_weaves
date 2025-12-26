import Razorpay from "razorpay";

export const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

// Refund related functions
export const createRefund = async (options: {
  paymentId: string;
  amount: number;
  notes?: any;
}) => {
  try {
    const refund = await razorpay.payments.refund(options.paymentId, {
      amount: options.amount, // amount in paise
      notes: options.notes || {},
    });
    return refund;
  } catch (error) {
    console.error('Razorpay refund error:', error);
    throw error;
  }
};

export const getRefundStatus = async (refundId: string) => {
  try {
    const refund = await razorpay.refunds.fetch(refundId);
    return refund;
  } catch (error) {
    console.error('Razorpay fetch refund error:', error);
    throw error;
  }
};

export const fetchPaymentDetails = async (paymentId: string) => {
  try {
    const payment = await razorpay.payments.fetch(paymentId);
    return payment;
  } catch (error) {
    console.error('Razorpay fetch payment error:', error);
    throw error;
  }
};
