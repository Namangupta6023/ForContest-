import { NextRequest, NextResponse } from 'next/server';
import { createPayPalOrder } from '@/lib/paypal';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { amount, currency, description } = body;

    // Input validation
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0 || parsedAmount > 100000) {
      return NextResponse.json({ error: 'Invalid amount. Must be a positive number up to 100,000.' }, { status: 400 });
    }

    const validCurrencies = ['USD', 'EUR', 'GBP', 'CAD', 'AUD'];
    const finalCurrency = typeof currency === 'string' && validCurrencies.includes(currency.toUpperCase())
      ? currency.toUpperCase()
      : 'USD';

    if (description !== undefined && typeof description !== 'string') {
      return NextResponse.json({ error: 'description must be a string.' }, { status: 400 });
    }

    const result = await createPayPalOrder({
      amount: parsedAmount,
      currency: finalCurrency,
      description: (description as string | undefined)?.slice(0, 500) || 'AgentVault Autonomous Purchase',
    });

    return NextResponse.json(result);
  } catch (error: unknown) {
    // Log full details server-side only
    console.error('[API] /api/paypal/create-order error:', error);
    return NextResponse.json(
      { error: 'PayPal order creation failed. Check server configuration.' },
      { status: 500 }
    );
  }
}
