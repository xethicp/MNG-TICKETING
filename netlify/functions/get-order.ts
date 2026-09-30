type NetlifyEvent = {
  httpMethod?: string;
  body?: string | null;
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
    'Access-Control-Allow-Origin': process.env.PUBLIC_SITE_ORIGIN || '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  },
  body: JSON.stringify(body),
});

const env = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing server environment variable: ${name}`);
  }
  return value;
};

export const handler = async (
  event: NetlifyEvent,
): Promise<NetlifyResponse> => {
  if (event.httpMethod === 'OPTIONS') {
    return json(204, null);
  }

  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method Not Allowed' });
  }

  try {
    const supabaseUrl = env('SUPABASE_URL').replace(/\/$/, '');
    const serviceRoleKey = env('SUPABASE_SERVICE_ROLE_KEY');

    const request = JSON.parse(event.body || '{}') as {
      order_id?: unknown;
      razorpay_payment_id?: unknown;
    };

    const orderId =
      typeof request.order_id === 'string' ? request.order_id : '';

    const paymentId =
      typeof request.razorpay_payment_id === 'string'
        ? request.razorpay_payment_id
        : '';

    if (!orderId || !paymentId) {
      return json(400, {
        error: 'Order and payment details are required.',
      });
    }

    const orderResponse = await fetch(
      `${supabaseUrl}/rest/v1/orders` +
        `?select=id,order_number,event_id,pass_type_id,quantity,amount_paise,` +
        `payment_status,status,razorpay_payment_id,created_at` +
        `&id=eq.${encodeURIComponent(orderId)}` +
        `&razorpay_payment_id=eq.${encodeURIComponent(paymentId)}` +
        `&limit=1`,
      {
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          Accept: 'application/json',
        },
      },
    );

    if (!orderResponse.ok) {
      throw new Error('ORDER_LOOKUP_FAILED');
    }

    const orders = (await orderResponse.json()) as Array<{
      id: string;
      order_number: string;
      event_id: string;
      pass_type_id: string | null;
      quantity: number;
      amount_paise: number;
      payment_status: string;
      status: string;
      razorpay_payment_id: string | null;
      created_at: string;
    }>;

    const order = orders[0];

    if (!order) {
      return json(404, {
        error: 'Order not found.',
      });
    }

    if (order.payment_status !== 'captured') {
      return json(400, {
        error: 'Payment has not been confirmed yet.',
      });
    }

    const [eventResponse, passResponse, ticketResponse] =
      await Promise.all([
        fetch(
          `${supabaseUrl}/rest/v1/events` +
            `?select=id,name,subtitle,venue,location,event_date,start_time,hero_image_url` +
            `&id=eq.${encodeURIComponent(order.event_id)}` +
            `&limit=1`,
          {
            headers: {
              apikey: serviceRoleKey,
              Authorization: `Bearer ${serviceRoleKey}`,
              Accept: 'application/json',
            },
          },
        ),

        order.pass_type_id
          ? fetch(
              `${supabaseUrl}/rest/v1/pass_types` +
                `?select=id,name,description` +
                `&id=eq.${encodeURIComponent(order.pass_type_id)}` +
                `&limit=1`,
              {
                headers: {
                  apikey: serviceRoleKey,
                  Authorization: `Bearer ${serviceRoleKey}`,
                  Accept: 'application/json',
                },
              },
            )
          : Promise.resolve(null),

        fetch(
          `${supabaseUrl}/rest/v1/tickets` +
            `?select=id,ticket_number,qr_token,status,created_at` +
            `&order_id=eq.${encodeURIComponent(order.id)}` +
            `&order=created_at.asc`,
          {
            headers: {
              apikey: serviceRoleKey,
              Authorization: `Bearer ${serviceRoleKey}`,
              Accept: 'application/json',
            },
          },
        ),
      ]);

    if (!eventResponse.ok || !ticketResponse.ok) {
      throw new Error('DETAIL_LOOKUP_FAILED');
    }

    const eventRows = (await eventResponse.json()) as Array<{
      id: string;
      name: string;
      subtitle: string | null;
      venue: string | null;
      location: string | null;
      event_date: string | null;
      start_time: string | null;
      hero_image_url: string | null;
    }>;

    const passRows = passResponse
      ? ((await passResponse.json()) as Array<{
          id: string;
          name: string;
          description: string | null;
        }>)
      : [];

    const tickets = (await ticketResponse.json()) as Array<{
      id: string;
      ticket_number: string;
      qr_token: string;
      status: string;
      created_at: string;
    }>;

    return json(200, {
      order: {
        id: order.id,
        order_number: order.order_number,
        quantity: order.quantity,
        amount_paise: Number(order.amount_paise),
        payment_status: order.payment_status,
        status: order.status,
        razorpay_payment_id: order.razorpay_payment_id,
        created_at: order.created_at,
      },
      event: eventRows[0] || null,
      pass: passRows[0] || null,
      tickets,
    });
  } catch {
    return json(500, {
      error: 'Unable to load your ticket details right now.',
    });
  }
};
