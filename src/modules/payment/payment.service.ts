import type Stripe from "stripe";
import { InvoiceStatus, PaymentMethod, PaymentStatus, Role } from "../../../prisma/generated/prisma/enums";
import config from "../../config";
import prisma from "../../lib/prisma";
import stripe from "../../lib/stripe";
import { AppError } from "../../utils/appError";
import { logAudit } from "../../utils/auditLogger";

export const createCheckoutSession = async (
  customerId: string,
  payload: { invoiceId: string }
) => {
  const invoice = await prisma.invoice.findUnique({
    where: { id: payload.invoiceId },
    include: {
      serviceRequest: {
        include: { service: true },
      },
    },
  });

  if (!invoice) {
    throw new AppError(404, "Invoice not found");
  }

  if (invoice.serviceRequest.customerId !== customerId) {
    throw new AppError(403, "Forbidden - This invoice does not belong to you");
  }

  if (invoice.status === InvoiceStatus.PAID) {
    throw new AppError(409, "Invoice has already been paid");
  }

  if (invoice.status === InvoiceStatus.CANCELLED) {
    throw new AppError(400, "Cannot pay for a cancelled invoice");
  }

  let session: Stripe.Checkout.Session;

  try {
    session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      metadata: {
        invoiceId: invoice.id,
        serviceRequestId: invoice.serviceRequestId,
        customerId,
      },
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: Math.round(invoice.totalAmount * 100),
            product_data: {
              name: `Invoice #${invoice.invoiceNumber} - ${invoice.serviceRequest.title}`,
              description: `Service: ${invoice.serviceRequest.service.name}`,
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${config.CLIENT_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}&invoice_id=${invoice.id}`,
      cancel_url: `${config.CLIENT_URL}/payment/cancel?invoice_id=${invoice.id}`,
    });
  } catch (err: any) {
    // If Stripe API key is in placeholder/mock mode in local test environment, provide simulation session
    if (config.STRIPE_SECRET_KEY.includes("placeholder") || config.STRIPE_SECRET_KEY.includes("mock")) {
      const mockSessionId = `cs_test_mock_${Date.now()}`;
      await prisma.payment.upsert({
        where: { transactionId: mockSessionId },
        create: {
          invoiceId: invoice.id,
          amount: invoice.totalAmount,
          method: PaymentMethod.STRIPE,
          status: PaymentStatus.PENDING,
          transactionId: mockSessionId,
        },
        update: {
          amount: invoice.totalAmount,
          status: PaymentStatus.PENDING,
        },
      });

      return {
        checkoutUrl: `${config.CLIENT_URL}/payment/success?session_id=${mockSessionId}&invoice_id=${invoice.id}`,
        sessionId: mockSessionId,
        isSimulated: true,
      };
    }
    throw new AppError(500, `Stripe checkout session creation failed: ${err.message}`);
  }

  await prisma.payment.upsert({
    where: { transactionId: session.id },
    create: {
      invoiceId: invoice.id,
      amount: invoice.totalAmount,
      method: PaymentMethod.STRIPE,
      status: PaymentStatus.PENDING,
      transactionId: session.id,
    },
    update: {
      amount: invoice.totalAmount,
      status: PaymentStatus.PENDING,
    },
  });

  return {
    checkoutUrl: session.url,
    sessionId: session.id,
  };
};

export const verifyPayment = async (
  payload: { sessionId: string; invoiceId?: string },
  userId: string
) => {
  const { sessionId } = payload;

  const payment = await prisma.payment.findFirst({
    where: { transactionId: sessionId },
    include: { invoice: { include: { serviceRequest: true } } },
  });

  if (!payment) {
    throw new AppError(404, "Payment record not found for this transaction session");
  }

  if (payment.status === PaymentStatus.COMPLETED) {
    return {
      message: "Payment is already marked as completed",
      payment,
    };
  }

  let isVerified = false;
  let paymentIntentId: string | null = null;
  let receiptUrl: string | null = null;

  if (sessionId.startsWith("cs_test_mock_")) {
    isVerified = true;
    paymentIntentId = `pi_mock_${Date.now()}`;
  } else {
    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      if (session.payment_status === "paid") {
        isVerified = true;
        paymentIntentId = (session.payment_intent as string) || null;
      }
    } catch (err: any) {
      throw new AppError(400, `Stripe verification failed: ${err.message}`);
    }
  }

  if (!isVerified) {
    throw new AppError(400, "Payment has not been completed on Stripe");
  }

  // Atomically update payment and invoice status in a Prisma transaction
  const result = await prisma.$transaction(async (tx) => {
    const updatedPayment = await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.COMPLETED,
        stripePaymentIntentId: paymentIntentId,
        receiptUrl,
        paidAt: new Date(),
      },
    });

    const updatedInvoice = await tx.invoice.update({
      where: { id: payment.invoiceId },
      data: {
        status: InvoiceStatus.PAID,
        paidAt: new Date(),
      },
    });

    return { payment: updatedPayment, invoice: updatedInvoice };
  });

  await logAudit({
    userId,
    action: "PAYMENT_COMPLETED",
    entity: "Payment",
    entityId: payment.id,
    details: { invoiceId: payment.invoiceId, amount: payment.amount },
  });

  return result;
};

export const handleStripeWebhook = async (
  rawBody: Buffer | string,
  sig: string
) => {
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      config.STRIPE_WEBHOOK_SECRET
    );
  } catch (err: any) {
    throw new AppError(400, `Webhook signature verification failed: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const invoiceId = session.metadata?.invoiceId;

    if (invoiceId) {
      await prisma.$transaction(async (tx) => {
        await tx.payment.updateMany({
          where: { transactionId: session.id },
          data: {
            status: PaymentStatus.COMPLETED,
            stripePaymentIntentId: session.payment_intent as string,
            paidAt: new Date(),
          },
        });

        await tx.invoice.update({
          where: { id: invoiceId },
          data: {
            status: InvoiceStatus.PAID,
            paidAt: new Date(),
          },
        });
      });

      await logAudit({
        action: "STRIPE_WEBHOOK_PAYMENT_COMPLETED",
        entity: "Invoice",
        entityId: invoiceId,
        details: { sessionId: session.id },
      });
    }
  }

  return { received: true };
};

export const getPaymentById = async (id: string, user: { id: string; role: Role }) => {
  const payment = await prisma.payment.findUnique({
    where: { id },
    include: {
      invoice: {
        include: {
          serviceRequest: {
            include: { customer: true, service: true },
          },
        },
      },
    },
  });

  if (!payment) {
    throw new AppError(404, "Payment record not found");
  }

  if (
    user.role === Role.CUSTOMER &&
    payment.invoice.serviceRequest.customerId !== user.id
  ) {
    throw new AppError(403, "Forbidden - You do not own this payment record");
  }

  return payment;
};
