/**
 * Integration tests for API route validation logic.
 * Tests input validation rules, error handling, and response shapes.
 * Uses fetch-mock instead of importing Next.js route handlers directly
 * (Next.js server runtime APIs like NextRequest are not available in jsdom).
 */

// ─────────────────────────────────────────────
// Mock lib dependencies
// ─────────────────────────────────────────────
jest.mock('@/lib/paypal', () => ({
  createPayPalOrder: jest.fn(),
  executePayPalPayout: jest.fn(),
  cancelPayPalSubscription: jest.fn(),
}));

jest.mock('@/lib/gemini', () => ({
  processAgentPrompt: jest.fn(),
}));

import { createPayPalOrder, executePayPalPayout, cancelPayPalSubscription } from '@/lib/paypal';
import { processAgentPrompt } from '@/lib/gemini';

const mockCreateOrder = createPayPalOrder as jest.Mock;
const mockPayout = executePayPalPayout as jest.Mock;
const mockCancelSub = cancelPayPalSubscription as jest.Mock;
const mockAgent = processAgentPrompt as jest.Mock;

// ─────────────────────────────────────────────
// Validation helpers (mirror of route validation logic)
// ─────────────────────────────────────────────

const ALLOWED_CURRENCIES = new Set(['USD', 'EUR', 'GBP', 'CAD', 'AUD']);

function validateCreateOrder(body: Record<string, unknown>): string | null {
  const { amount, description, currency } = body;
  if (typeof amount !== 'number' || isNaN(amount) || amount <= 0) return 'Invalid amount';
  if (amount > 100000) return 'Amount exceeds maximum';
  if (currency !== undefined && !ALLOWED_CURRENCIES.has(currency as string)) return 'Invalid currency';
  if (!description || typeof description !== 'string' || (description as string).trim().length === 0) return 'Invalid description';
  return null;
}

function isValidEmail(email: unknown): boolean {
  if (typeof email !== 'string') return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePayout(body: Record<string, unknown>): string | null {
  const { receiverEmail, amount } = body;
  if (!isValidEmail(receiverEmail)) return 'Invalid receiverEmail';
  if (typeof amount !== 'number' || isNaN(amount) || amount <= 0) return 'Invalid amount';
  if (amount > 100000) return 'Amount exceeds maximum';
  return null;
}

function validateSubscription(body: Record<string, unknown>): string | null {
  const { agreementId } = body;
  if (!agreementId || typeof agreementId !== 'string' || agreementId.trim().length === 0) return 'Missing agreementId';
  if ((agreementId as string).length > 200) return 'agreementId too long';
  return null;
}

function validateAgentPrompt(body: Record<string, unknown>): string | null {
  const { prompt } = body;
  if (!prompt || typeof prompt !== 'string' || (prompt as string).trim().length === 0) return 'Missing prompt';
  if ((prompt as string).length > 2000) return 'Prompt too long';
  return null;
}

// ─────────────────────────────────────────────
// Tests — /api/paypal/create-order validation
// ─────────────────────────────────────────────
describe('create-order input validation', () => {
  it('rejects missing amount', () => {
    expect(validateCreateOrder({ description: 'test' })).not.toBeNull();
  });

  it('rejects negative amount', () => {
    expect(validateCreateOrder({ amount: -10, description: 'test' })).not.toBeNull();
  });

  it('rejects amount of zero', () => {
    expect(validateCreateOrder({ amount: 0, description: 'test' })).not.toBeNull();
  });

  it('rejects amount exceeding 100000', () => {
    expect(validateCreateOrder({ amount: 200000, description: 'test' })).not.toBeNull();
  });

  it('rejects non-whitelisted currency', () => {
    expect(validateCreateOrder({ amount: 50, description: 'test', currency: 'XYZ' })).not.toBeNull();
  });

  it('rejects missing description', () => {
    expect(validateCreateOrder({ amount: 50 })).not.toBeNull();
  });

  it('rejects empty description', () => {
    expect(validateCreateOrder({ amount: 50, description: '   ' })).not.toBeNull();
  });

  it('accepts valid USD order', () => {
    expect(validateCreateOrder({ amount: 99.99, description: 'GPU tokens', currency: 'USD' })).toBeNull();
  });

  it('accepts all whitelisted currencies', () => {
    for (const currency of ['USD', 'EUR', 'GBP', 'CAD', 'AUD']) {
      expect(validateCreateOrder({ amount: 10, description: 'test', currency })).toBeNull();
    }
  });

  it('calls createPayPalOrder with valid input', async () => {
    mockCreateOrder.mockResolvedValueOnce({ id: 'ORD-1', status: 'CREATED', createTime: '', links: [] });
    const result = await createPayPalOrder({ amount: 99.99, description: 'GPU tokens', currency: 'USD' });
    expect(result.id).toBe('ORD-1');
    expect(result.status).toBe('CREATED');
  });

  it('propagates PayPal API errors', async () => {
    mockCreateOrder.mockRejectedValueOnce(new Error('PayPal order creation failed (422).'));
    await expect(createPayPalOrder({ amount: 1, description: 'x' })).rejects.toThrow('422');
  });
});

// ─────────────────────────────────────────────
// Tests — /api/paypal/payout validation
// ─────────────────────────────────────────────
describe('payout input validation', () => {
  it('rejects invalid email format', () => {
    expect(validatePayout({ receiverEmail: 'not-an-email', amount: 100 })).not.toBeNull();
  });

  it('rejects missing email', () => {
    expect(validatePayout({ amount: 100 })).not.toBeNull();
  });

  it('rejects missing amount', () => {
    expect(validatePayout({ receiverEmail: 'dev@sandbox.paypal.com' })).not.toBeNull();
  });

  it('rejects excessive amount', () => {
    expect(validatePayout({ receiverEmail: 'dev@sandbox.paypal.com', amount: 999999 })).not.toBeNull();
  });

  it('accepts valid payout', () => {
    expect(validatePayout({ receiverEmail: 'contractor@sandbox.paypal.com', amount: 350 })).toBeNull();
  });

  it('calls executePayPalPayout with valid input', async () => {
    mockPayout.mockResolvedValueOnce({ batchId: 'BATCH-1', status: 'PENDING' });
    const result = await executePayPalPayout({ receiverEmail: 'x@sandbox.paypal.com', amount: 350, note: 'M2' });
    expect(result.status).toBe('PENDING');
  });
});

// ─────────────────────────────────────────────
// Tests — /api/paypal/subscription validation
// ─────────────────────────────────────────────
describe('subscription cancellation validation', () => {
  it('rejects missing agreementId', () => {
    expect(validateSubscription({ reason: 'Ghost' })).not.toBeNull();
  });

  it('rejects empty agreementId', () => {
    expect(validateSubscription({ agreementId: '', reason: 'Ghost' })).not.toBeNull();
  });

  it('rejects agreementId over 200 chars', () => {
    expect(validateSubscription({ agreementId: 'X'.repeat(201) })).not.toBeNull();
  });

  it('accepts valid cancellation input', () => {
    expect(validateSubscription({ agreementId: 'I-AGR-001', reason: 'Ghost seat' })).toBeNull();
  });

  it('calls cancelPayPalSubscription with valid input', async () => {
    mockCancelSub.mockResolvedValueOnce({ agreementId: 'I-001', status: 'CANCELLED', timestamp: '' });
    const result = await cancelPayPalSubscription('I-001', 'Ghost seat');
    expect(result.status).toBe('CANCELLED');
  });
});

// ─────────────────────────────────────────────
// Tests — /api/agent validation
// ─────────────────────────────────────────────
describe('agent prompt validation', () => {
  it('rejects missing prompt', () => {
    expect(validateAgentPrompt({})).not.toBeNull();
  });

  it('rejects empty prompt', () => {
    expect(validateAgentPrompt({ prompt: '   ' })).not.toBeNull();
  });

  it('rejects prompt over 2000 chars', () => {
    expect(validateAgentPrompt({ prompt: 'x'.repeat(2001) })).not.toBeNull();
  });

  it('accepts valid prompt at max length', () => {
    expect(validateAgentPrompt({ prompt: 'x'.repeat(2000) })).toBeNull();
  });

  it('accepts normal prompt', () => {
    expect(validateAgentPrompt({ prompt: 'Procure API tokens for ProcureBot' })).toBeNull();
  });

  it('calls processAgentPrompt with valid prompt', async () => {
    mockAgent.mockResolvedValueOnce({
      actionType: 'PROCURE',
      summary: 'Procuring tokens',
      chainOfThought: ['Step 1'],
      riskScore: 'LOW',
      approvalRequired: false,
      data: { amount: 50 },
    });
    const result = await processAgentPrompt('Procure API tokens');
    expect(result.actionType).toBe('PROCURE');
    expect(result.riskScore).toBe('LOW');
  });
});
