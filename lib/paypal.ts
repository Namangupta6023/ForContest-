// PayPal Sandbox REST API Direct Client
// Hits https://api-m.sandbox.paypal.com directly

export interface PayPalOrderRequest {
  amount: number;
  currency?: string;
  description: string;
  merchantName?: string;
  agentId?: string;
}

export interface PayPalPayoutRequest {
  receiverEmail: string;
  amount: number;
  currency?: string;
  note: string;
  milestoneId?: string;
}

// Reads credentials exclusively from server-side environment variables.
// Never accepts credentials from the client.
function getPayPalCredentials(): { cid: string; secret: string } {
  const cid = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;

  if (!cid || cid.trim().length === 0) {
    throw new Error('PAYPAL_CLIENT_ID environment variable is not configured.');
  }
  if (!secret || secret.trim().length === 0) {
    throw new Error('PAYPAL_CLIENT_SECRET environment variable is not configured.');
  }

  return { cid, secret };
}

// 1. Get OAuth Access Token from PayPal Sandbox
export async function getPayPalAccessToken(): Promise<string> {
  const { cid, secret } = getPayPalCredentials();
  const auth = Buffer.from(`${cid}:${secret}`).toString('base64');

  const res = await fetch('https://api-m.sandbox.paypal.com/v1/oauth2/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
    cache: 'no-store',
  });

  if (!res.ok) {
    // Log details server-side only; don't forward to client
    const errorText = await res.text();
    console.error(`[PayPal] OAuth failed (${res.status}):`, errorText);
    throw new Error(`PayPal authentication failed (${res.status}). Check server credentials.`);
  }

  const data = await res.json();
  return data.access_token;
}

// 2. Create PayPal Sandbox Order (Orders API v2)
export async function createPayPalOrder(order: PayPalOrderRequest) {
  const token = await getPayPalAccessToken();
  const currency = order.currency || 'USD';

  const res = await fetch('https://api-m.sandbox.paypal.com/v2/checkout/orders', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: `agent-procure-${crypto.randomUUID()}`,
          description: order.description,
          amount: {
            currency_code: currency,
            value: order.amount.toFixed(2),
          },
        },
      ],
    }),
    cache: 'no-store',
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error(`[PayPal] Order creation failed (${res.status}):`, errorText);
    throw new Error(`PayPal order creation failed (${res.status}).`);
  }

  const data = await res.json();
  return {
    id: data.id,
    status: data.status,
    createTime: data.create_time,
    links: data.links,
  };
}

// 3. Execute PayPal Sandbox Payout (Payouts API v1)
export async function executePayPalPayout(payout: PayPalPayoutRequest) {
  const token = await getPayPalAccessToken();
  const currency = payout.currency || 'USD';
  const batchId = `BATCH-${crypto.randomUUID()}`;

  const res = await fetch('https://api-m.sandbox.paypal.com/v1/payments/payouts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sender_batch_header: {
        sender_batch_id: batchId,
        email_subject: `AgentVault Escrow Payout: ${payout.note}`,
        recipient_type: 'EMAIL',
      },
      items: [
        {
          recipient_type: 'EMAIL',
          amount: {
            value: payout.amount.toFixed(2),
            currency,
          },
          note: payout.note,
          receiver: payout.receiverEmail,
          sender_item_id: payout.milestoneId || crypto.randomUUID(),
        },
      ],
    }),
    cache: 'no-store',
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error(`[PayPal] Payout failed (${res.status}):`, errorText);
    throw new Error(`PayPal payout failed (${res.status}).`);
  }

  const data = await res.json();
  return {
    batchId: data.batch_header?.payout_batch_id || batchId,
    status: data.batch_header?.batch_status || 'PENDING',
  };
}

// 4. Cancel PayPal Billing Agreement (Subscriptions API)
export async function cancelPayPalSubscription(agreementId: string, reason: string) {
  const token = await getPayPalAccessToken();

  const res = await fetch(
    `https://api-m.sandbox.paypal.com/v1/billing/subscriptions/${agreementId}/cancel`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        reason: reason || 'AgentVault automated subscription audit',
      }),
      cache: 'no-store',
    }
  );

  if (!res.ok && res.status !== 204) {
    const errorText = await res.text();
    console.error(`[PayPal] Subscription cancellation failed (${res.status}):`, errorText);
    throw new Error(`PayPal subscription cancellation failed (${res.status}).`);
  }

  return {
    agreementId,
    status: 'CANCELLED',
    timestamp: new Date().toISOString(),
  };
}
