/**
 * MNG secure checkout boundary.
 *
 * Browser sends only event/pass/quantity.
 * Server re-reads the live price + inventory from Supabase,
 * reserves inventory atomically, then creates the Razorpay TEST order.
 * Razorpay + Supabase secret keys stay server-side.
 */

type NetlifyEvent = {
  httpMethod?: string;
  body?: string | null;
};

type NetlifyResponse = {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
};

type Reservation = {
  order_id: string;
  order_number: string;
  amount_paise: number;
  unit_price_paise: number;
  quantity: number;
};

const json = (statusCode: number, body: unknown, origin = '*'): NetlifyResponse => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  },
  body: JSON.stringify(body),
});

const getEnv = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing server environment variable: ${name}`);
  return value;
};

const supabaseRpc = async (
  supabaseUrl: string,
  serviceRoleKey: string,
  eventId: string,
  passTypeId: string,
  quantity: number,
): Promise<Reservation> => {
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/mng_reserve_ticket_order`, {
    method: 'POST',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      p_event_id: eventId,
      p_pass_type_id: passTypeId,
      p_quantity: quantity,
    }),
  });

  const text = await response.text();
  if (!response.ok) {
    let message = 'Unable to reserve inventory.';
    try {
      const parsed = JSON.parse(text);
      message = parsed?.message || parsed?.hint || message;
    } catch {
      // Keep the safe fallback message.
    }
    throw new Error(message);
  }

  const data = JSON.parse(text) as Reservation[];
  const reservation = data?.[0];
  if (!reservation?.order_id || !reservation.order_number || !Number.isFinite(Number(reservation.amount_paise))) {
    throw new Error('Invalid reservation response.');
  }
  return {
    order_id: reservation.order_id,
    order_number: reservation.order_number,
    amount_paise: Number(reservation.amount_paise),
    unit_price_paise: Number(reservation.unit_price_paise),
    quantity: Number(reservation.quantity),
  };
};

const updateInternalOrder = async (
  supabaseUrl: string,
  serviceRoleKey: string,
  orderId: string,
  razorpayOrderId: string,
): Promise<boolean> => {
  const response = await fetch(`${supabaseUrl}/rest/v1/orders?id=eq.${encodeURIComponent(orderId)}`, {
    method: 'PATCH',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ razorpay_order_id: razorpayOrderId }),
  });
  return response.ok;
};

export const handler = async (event: NetlifyEvent): Promise<NetlifyResponse> => {
  const origin = process.env.PUBLIC_SITE_ORIGIN || '*';

  if (event.httpMethod === 'OPTIONS') return json(204, null, origin);
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' }, origin);

  try {
    const supabaseUrl = getEnv('SUPABASE_URL').replace(/\/$/, '');
    const serviceRoleKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');
    const razorpayKeyId = getEnv('RAZORPAY_KEY_ID');
    const razorpayKeySecret = getEnv('RAZORPAY_KEY_SECRET');

    const request = JSON.parse(event.body || '{}') as {
      event_id?: unknown;
      pass_type_id?: unknown;
      quantity?: unknown;
    };

    const eventId = typeof request.event_id === 'string' ? request.event_id : '';
    const passTypeId = typeof request.pass_type_id === 'string' ? request.pass_type_id : '';
    const quantity = request.quantity;

    if (!eventId || !passTypeId || !Number.isInteger(quantity) || Number(quantity) < 1 || Number(quantity) > 10) {
      return json(400, { error: 'Invalid checkout request.' }, origin);
    }

    const reservation = await supabaseRpc(
      supabaseUrl,
      serviceRoleKey,
      eventId,
      passTypeId,
      Number(quantity),
    );

    const basicAuth = Buffer.from(`${razorpayKeyId}:${razorpayKeySecret}`, 'utf8').toString('base64');
    const razorpayResponse = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basicAuth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: reservation.amount_paise,
        currency: 'INR',
        receipt: reservation.order_number,
        notes: {
          mng_order_id: reservation.order_id,
          event_id: eventId,
          pass_type_id: passTypeId,
          quantity: String(reservation.quantity),
        },
      }),
    });

    const razorpayText = await razorpayResponse.text();
    let razorpayData: Record<string, unknown> = {};
    try {
      razorpayData = JSON.parse(razorpayText) as Record<string, unknown>;
    } catch {
      // Keep an empty object and return the safe generic message below.
    }

    if (!razorpayResponse.ok) {
      return json(
        502,
        { error: 'Razorpay could not create the test order. Your payment was not started.' },
        origin,
      );
    }

    const razorpayOrderId = typeof razorpayData.id === 'string' ? razorpayData.id : '';
    if (!razorpayOrderId) {
      return json(502, { error: 'Razorpay returned an invalid order.' }, origin);
    }

    const internalOrderUpdated = await updateInternalOrder(
      supabaseUrl,
      serviceRoleKey,
      reservation.order_id,
      razorpayOrderId,
    );

    return json(200, {
      order_id: reservation.order_id,
      order_number: reservation.order_number,
      razorpay_order_id: razorpayOrderId,
      razorpay_key_id: razorpayKeyId,
      amount_paise: reservation.amount_paise,
      quantity: reservation.quantity,
      internal_order_updated: internalOrderUpdated,
    }, origin);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create checkout order.';
    const safeMessage = message === 'PASS_UNAVAILABLE'
      ? 'This pass is no longer available.'
      : message === 'INSUFFICIENT_INVENTORY'
        ? 'Not enough tickets are available for this quantity.'
        : message === 'INVALID_QUANTITY'
          ? 'Choose between 1 and 10 tickets.'
          : 'Unable to create checkout order right now.';

    return json(400, { error: safeMessage }, origin);
  }
};
