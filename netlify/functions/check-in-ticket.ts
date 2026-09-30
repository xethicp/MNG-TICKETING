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

const json = (
  statusCode: number,
  body: unknown,
): NetlifyResponse => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin':
      process.env.PUBLIC_SITE_ORIGIN || '*',
    'Access-Control-Allow-Headers':
      'Content-Type, Authorization',
    'Access-Control-Allow-Methods':
      'POST, OPTIONS',
  },
  body: JSON.stringify(body),
});

const env = (name: string): string => {
  const value = process.env[name];

  if (!value) {
    throw new Error(
      `Missing server environment variable: ${name}`,
    );
  }

  return value;
};

const getHeader = (
  event: NetlifyEvent,
  name: string,
): string => {
  const headers = event.headers || {};

  return (
    headers[name] ||
    headers[name.toLowerCase()] ||
    headers[name.toUpperCase()] ||
    ''
  );
};

const getSignedInUser = async (
  supabaseUrl: string,
  serviceRoleKey: string,
  accessToken: string,
) => {
  const response = await fetch(
    `${supabaseUrl}/auth/v1/user`,
    {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (!response.ok) {
    return null;
  }

  const user = (await response.json()) as {
    id?: unknown;
  };

  return typeof user.id === 'string' ? user : null;
};

const getStaffRole = async (
  supabaseUrl: string,
  serviceRoleKey: string,
  userId: string,
) => {
  const response = await fetch(
    `${supabaseUrl}/rest/v1/profiles` +
      `?select=id,role` +
      `&id=eq.${encodeURIComponent(userId)}` +
      `&limit=1`,
    {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        Accept: 'application/json',
      },
    },
  );

  if (!response.ok) {
    throw new Error('PROFILE_LOOKUP_FAILED');
  }

  const rows = (await response.json()) as Array<{
    id: string;
    role: string;
  }>;

  return rows[0]?.role || null;
};

const checkIn = async (
  supabaseUrl: string,
  serviceRoleKey: string,
  qrToken: string,
  userId: string,
) => {
  const response = await fetch(
    `${supabaseUrl}/rest/v1/rpc/mng_check_in_ticket`,
    {
      method: 'POST',
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        p_qr_token: qrToken.trim(),
        p_checked_in_by: userId,
      }),
    },
  );

  const responseText = await response.text();

  if (!response.ok) {
    let message = 'CHECKIN_FAILED';

    try {
      const parsed = JSON.parse(responseText);

      message =
        parsed?.message ||
        parsed?.hint ||
        message;
    } catch {
      // Keep safe fallback.
    }

    throw new Error(message);
  }

  const result = JSON.parse(responseText);

  return Array.isArray(result)
    ? result[0]
    : result;
};

export const handler = async (
  event: NetlifyEvent,
): Promise<NetlifyResponse> => {
  if (event.httpMethod === 'OPTIONS') {
    return json(204, null);
  }

  if (event.httpMethod !== 'POST') {
    return json(405, {
      error: 'Method Not Allowed',
    });
  }

  try {
    const supabaseUrl = env('SUPABASE_URL').replace(
      /\/$/,
      '',
    );

    const serviceRoleKey = env(
      'SUPABASE_SERVICE_ROLE_KEY',
    );

    const authorization = getHeader(
      event,
      'authorization',
    );

    const accessToken =
      authorization.startsWith('Bearer ')
        ? authorization.slice(7).trim()
        : '';

    if (!accessToken) {
      return json(401, {
        error: 'Staff authentication required.',
      });
    }

    const user = await getSignedInUser(
      supabaseUrl,
      serviceRoleKey,
      accessToken,
    );

    if (!user?.id) {
      return json(401, {
        error: 'Your staff session is invalid or expired.',
      });
    }

    const role = await getStaffRole(
      supabaseUrl,
      serviceRoleKey,
      user.id,
    );

    if (
      role !== 'owner' &&
      role !== 'admin' &&
      role !== 'event_manager'
    ) {
      return json(403, {
        error: 'You are not authorised to scan tickets.',
      });
    }

    const request = JSON.parse(
      event.body || '{}',
    ) as {
      qr_token?: unknown;
    };

    const qrToken =
      typeof request.qr_token === 'string'
        ? request.qr_token.trim()
        : '';

    if (!qrToken || qrToken.length < 16) {
      return json(400, {
        error: 'Invalid QR credential.',
      });
    }

    const result = await checkIn(
      supabaseUrl,
      serviceRoleKey,
      qrToken,
      user.id,
    );

    if (!result) {
      return json(500, {
        error: 'Ticket validation returned no result.',
      });
    }

    if (result.was_already_used) {
      return json(409, {
        valid: false,
        already_used: true,
        ticket_number: result.ticket_number,
        event_name: result.event_name,
        pass_name: result.pass_name,
        checked_in_at: result.checked_in_at,
      });
    }

    return json(200, {
      valid: true,
      already_used: false,
      ticket_number: result.ticket_number,
      event_name: result.event_name,
      pass_name: result.pass_name,
      checked_in_at: result.checked_in_at,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'CHECKIN_FAILED';

    if (message.includes('TICKET_NOT_FOUND')) {
      return json(404, {
        valid: false,
        error: 'This QR is not an MNG ticket.',
      });
    }

    if (message.includes('TICKET_NOT_VALID')) {
      return json(409, {
        valid: false,
        error: 'This ticket is not valid for entry.',
      });
    }

    if (message.includes('INVALID_QR')) {
      return json(400, {
        valid: false,
        error: 'Invalid QR credential.',
      });
    }

    if (message.includes('TICKET_CHECKIN_CONFLICT')) {
      return json(409, {
        valid: false,
        error: 'This ticket was just scanned. Please scan again.',
      });
    }

    return json(500, {
      valid: false,
      error: 'Ticket validation failed. Please try again.',
    });
  }
};
