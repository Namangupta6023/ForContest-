import { NextRequest, NextResponse } from 'next/server';
import { cancelPayPalSubscription } from '@/lib/paypal';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { agreementId, reason } = body;

    // Input validation
    if (!agreementId || typeof agreementId !== 'string' || agreementId.trim().length === 0) {
      return NextResponse.json({ error: 'agreementId is required and must be a non-empty string.' }, { status: 400 });
    }

    if (agreementId.length > 200) {
      return NextResponse.json({ error: 'agreementId is too long.' }, { status: 400 });
    }

    const sanitizedReason = typeof reason === 'string'
      ? reason.slice(0, 255)
      : 'AgentVault automated subscription audit';

    const result = await cancelPayPalSubscription(agreementId.trim(), sanitizedReason);
    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error('[API] /api/paypal/subscription error:', error);
    return NextResponse.json(
      { error: 'PayPal subscription cancellation failed. Check server configuration.' },
      { status: 500 }
    );
  }
}
