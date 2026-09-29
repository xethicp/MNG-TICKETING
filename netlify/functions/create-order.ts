/**
 * Secure checkout boundary.
 * The browser sends only event/pass/quantity. The server MUST read current
 * price + inventory from Supabase before creating a Razorpay order.
 * Razorpay secrets are never exposed to the browser.
 */
type NetlifyEvent = { httpMethod?: string; body?: string | null };
type NetlifyResponse = { statusCode: number; body: string };

export const handler = async (event: NetlifyEvent): Promise<NetlifyResponse> => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  try {
    const body = JSON.parse(event.body || '{}');
    const { event_id, pass_type_id, quantity } = body;
    if (!event_id || !pass_type_id || !Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Invalid checkout request' }) };
    }
    // TODO: connect SUPABASE_SERVICE_ROLE_KEY server-side, fetch current pass
    // price/inventory, atomically reserve inventory, calculate amount, create
    // Razorpay order, and return only the order id + public key.
    return { statusCode: 501, body: JSON.stringify({ error: 'Payment backend is intentionally disabled until Supabase/Razorpay secrets are configured.' }) };
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request' }) };
  }
};
