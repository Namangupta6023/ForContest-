import { NextRequest, NextResponse } from 'next/server';
import { executePayPalPayout } from '@/lib/paypal';

// Basic email format check
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { receiverEmail, amount, note, milestoneId } = body;

    // Input validation
    if (!receiverEmail || typeof receiverEmail !== 'string' || !isValidEmail(receiverEmail)) {
      return NextResponse.json({ error: 'A valid receiverEmail is required.' }, { status: 400 });
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0 || parsedAmount > 100000) {
      return NextResponse.json({ error: 'Invalid amount. Must be a positive number up to 100,000.' }, { status: 400 });
    }

    if (milestoneId !== undefined && typeof milestoneId !== 'string') {
      return NextResponse.json({ error: 'milestoneId must be a string.' }, { status: 400 });
    }

    const result = await executePayPalPayout({
      receiverEmail,
      amount: parsedAmount,
      note: typeof note === 'string' ? note.slice(0, 255) : 'AgentVault Escrow Release',
      milestoneId: typeof milestoneId === 'string' ? milestoneId.slice(0, 100) : undefined,
    });

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error('[API] /api/paypal/payout error:', error);
    return NextResponse.json(
      { error: 'PayPal payout failed. Check server configuration.' },
      { status: 500 }
    );
  }
}
