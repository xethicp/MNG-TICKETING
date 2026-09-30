import { createHmac, timingSafeEqual } from 'node:crypto';

type NetlifyEvent = {
  httpMethod?: string;
  body?: string | null;
  headers?: Record<string, string | undefined>;
};

type NetlifyResponse = {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
};

const json = (statusCode: number, body: unknown): NetlifyResponse => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, x-razorpay-signature',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  },
  body: JSON.stringify(body),
});

const env = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing server environment variable: ${name}`);
  return value;
};

const header = (event: NetlifyEvent, name: string): string => {
  const headers = event.headers || {};
  return headers[name] || headers[name.toLowerCase()] || headers[name.toUpperCase()] || '';
};

const verifySignature = (rawBody: string, receivedSignature: string, secret: string): boolean => {
  if (!receivedSignature) return false;
  const expected = createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
  const expectedBuffer = Buffer.from(expected, 'utf8');
  const receivedBuffer = Buffer.from(receivedSignature, 'utf8');
  return expectedBuffer.length === receivedBuffer.length && timingSafeEqual(expectedBuffer, receivedBuffer);
};

const findOrderByRazorpayId = async (
  supabaseUrl: string,
  serviceRoleKey: string,
  razorpayOrderId: string,
) => {
  const response = await fetch(
    `${supabaseUrl}/rest/v1/orders?select=id,razorpay_order_id&razorpay_order_id=eq.${encodeURIComponent(razorpayOrderId)}&limit=1`,
    {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        Accept: 'application/json',
      },
    },
  );

  if (!response.ok) throw new Error('ORDER_LOOKUP_FAILED');
  const data = (await response.json()) as Array<{ id: string; razorpay_order_id: string | null }>;
  return data[0] || null;
};

const finalizeOrder = async (
  supabaseUrl: string,
  serviceRoleKey: string,
  orderId: string,
  paymentId: string,
) => {
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/mng_finalize_paid_order`, {
    method: 'POST',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      p_order_id: orderId,
      p_payment_id: paymentId,
    }),
  });

  const responseText = await response.text();
  if (!response.ok) {
    throw new Error('PAYMENT_FINALIZATION_FAILED');
  }

  let parsed: unknown = null;
  try {
    parsed = JSON.parse(responseText);
  } catch {
    // Some PostgREST responses may be empty for scalar RPC results.
  }

  return parsed;
};

export const handler = async (event: NetlifyEvent): Promise<NetlifyResponse> => {
  if (event.httpMethod === 'OPTIONS') return json(204, null);
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' });

  const rawBody = event.body || '';

  try {
    const webhookSecret = env('RAZORPAY_WEBHOOK_SECRET');
    const supabaseUrl = env('SUPABASE_URL').replace(/\/$/, '');
    const serviceRoleKey = env('SUPABASE_SERVICE_ROLE_KEY');
    const signature = header(event, 'x-razorpay-signature');

    if (!verifySignature(rawBody, signature, webhookSecret)) {
      return json(400, { error: 'Invalid webhook signature.' });
    }

    const payload = JSON.parse(rawBody) as {
      event?: unknown;
      payload?: {
        payment?: {
          entity?: {
            id?: unknown;
            order_id?: unknown;
            status?: unknown;
          };
        };
        order?: {
          entity?: {
            id?: unknown;
          };
        };
      };
    };

    const eventName = typeof payload.event === 'string' ? payload.event : '';

    // We finalize only confirmed payment events. Other webhook events are
    // acknowledged without changing inventory or issuing tickets.
    if (eventName !== 'payment.captured' && eventName !== 'order.paid') {
      return json(200, { received: true, processed: false, event: eventName || 'unknown' });
    }

    const payment = payload.payload?.payment?.entity;
    const orderEntity = payload.payload?.order?.entity;
    const paymentId = typeof payment?.id === 'string' ? payment.id : '';
    const razorpayOrderId = typeof payment?.order_id === 'string'
      ? payment.order_id
      : typeof orderEntity?.id === 'string'
        ? orderEntity.id
        : '';

    if (!paymentId || !razorpayOrderId) {
      return json(400, { error: 'Webhook payload is missing payment/order identifiers.' });
    }

    const internalOrder = await findOrderByRazorpayId(supabaseUrl, serviceRoleKey, razorpayOrderId);

    // Razorpay may send valid events for orders that were not created by MNG.
    if (!internalOrder) {
      return json(200, { received: true, processed: false, reason: 'order_not_found' });
    }

    const result = await finalizeOrder(supabaseUrl, serviceRoleKey, internalOrder.id, paymentId);

    return json(200, {
      received: true,
      processed: true,
      order_id: internalOrder.id,
      razorpay_order_id: razorpayOrderId,
      razorpay_payment_id: paymentId,
      result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Webhook processing failed.';
    const safeMessage = message === 'PAYMENT_FINALIZATION_FAILED'
      ? 'Payment received, but finalization is pending.'
      : 'Webhook processing failed.';

    return json(500, { error: safeMessage });
  }
};
