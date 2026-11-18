/**
 * Unit tests for lib/paypal.ts
 * Tests credential validation, order creation, payout, and subscription cancellation.
 */

// We test the exported functions by mocking fetch and env variables.

const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('PayPal Library — getPayPalAccessToken', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    delete process.env.PAYPAL_CLIENT_ID;
    delete process.env.PAYPAL_CLIENT_SECRET;
  });

  it('throws if PAYPAL_CLIENT_ID is missing', async () => {
    process.env.PAYPAL_CLIENT_SECRET = 'test-secret';
    const { getPayPalAccessToken } = await import('@/lib/paypal');
    await expect(getPayPalAccessToken()).rejects.toThrow('PAYPAL_CLIENT_ID');
  });

  it('throws if PAYPAL_CLIENT_SECRET is missing', async () => {
    process.env.PAYPAL_CLIENT_ID = 'test-id';
    const { getPayPalAccessToken } = await import('@/lib/paypal');
    await expect(getPayPalAccessToken()).rejects.toThrow('PAYPAL_CLIENT_SECRET');
  });

  it('returns access token on successful OAuth response', async () => {
    process.env.PAYPAL_CLIENT_ID = 'test-cid';
    process.env.PAYPAL_CLIENT_SECRET = 'test-secret';
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: 'mock-token-xyz' }),
    });
    const { getPayPalAccessToken } = await import('@/lib/paypal');
    const token = await getPayPalAccessToken();
    expect(token).toBe('mock-token-xyz');
  });

  it('throws a safe error message if OAuth fails', async () => {
    process.env.PAYPAL_CLIENT_ID = 'bad-id';
    process.env.PAYPAL_CLIENT_SECRET = 'bad-secret';
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized',
    });
    const { getPayPalAccessToken } = await import('@/lib/paypal');
    await expect(getPayPalAccessToken()).rejects.toThrow('PayPal authentication failed (401)');
  });
});

describe('PayPal Library — createPayPalOrder', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    process.env.PAYPAL_CLIENT_ID = 'cid';
    process.env.PAYPAL_CLIENT_SECRET = 'secret';
  });

  it('creates an order and returns id/status', async () => {
    // First call: OAuth; Second call: create order
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'tok' }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'ORDER-123',
          status: 'CREATED',
          create_time: '2026-01-01T00:00:00Z',
          links: [],
        }),
      });
    const { createPayPalOrder } = await import('@/lib/paypal');
    const result = await createPayPalOrder({ amount: 99.99, description: 'Test order', currency: 'USD' });
    expect(result.id).toBe('ORDER-123');
    expect(result.status).toBe('CREATED');
  });

  it('throws safe error on order creation failure', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'tok' }) })
      .mockResolvedValueOnce({ ok: false, status: 422, text: async () => 'Unprocessable' });
    const { createPayPalOrder } = await import('@/lib/paypal');
    await expect(
      createPayPalOrder({ amount: 1, description: 'x' })
    ).rejects.toThrow('PayPal order creation failed (422)');
  });

  it('uses USD as default currency', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'tok' }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'O-1', status: 'CREATED', create_time: '', links: [] }),
      });
    const { createPayPalOrder } = await import('@/lib/paypal');
    await createPayPalOrder({ amount: 10, description: 'No currency' });
    const body = JSON.parse(mockFetch.mock.calls[1][1].body);
    expect(body.purchase_units[0].amount.currency_code).toBe('USD');
  });
});

describe('PayPal Library — executePayPalPayout', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    process.env.PAYPAL_CLIENT_ID = 'cid';
    process.env.PAYPAL_CLIENT_SECRET = 'secret';
  });

  it('dispatches payout and returns batch status', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'tok' }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          batch_header: { payout_batch_id: 'BATCH-999', batch_status: 'PENDING' },
        }),
      });
    const { executePayPalPayout } = await import('@/lib/paypal');
    const result = await executePayPalPayout({
      receiverEmail: 'contractor@sandbox.paypal.com',
      amount: 350,
      note: 'Milestone 1 payout',
    });
    expect(result.status).toBe('PENDING');
    expect(result.batchId).toBe('BATCH-999');
  });
});

describe('PayPal Library — cancelPayPalSubscription', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    process.env.PAYPAL_CLIENT_ID = 'cid';
    process.env.PAYPAL_CLIENT_SECRET = 'secret';
  });

  it('returns CANCELLED status on 204 response', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'tok' }) })
      .mockResolvedValueOnce({ ok: false, status: 204, text: async () => '' });
    const { cancelPayPalSubscription } = await import('@/lib/paypal');
    const result = await cancelPayPalSubscription('I-AGR-001', 'Ghost seat — 0% activity');
    expect(result.status).toBe('CANCELLED');
    expect(result.agreementId).toBe('I-AGR-001');
  });

  it('throws on unexpected cancellation failure', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'tok' }) })
      .mockResolvedValueOnce({ ok: false, status: 500, text: async () => 'Internal Error' });
    const { cancelPayPalSubscription } = await import('@/lib/paypal');
    await expect(
      cancelPayPalSubscription('I-BAD', 'reason')
    ).rejects.toThrow('PayPal subscription cancellation failed (500)');
  });
});
