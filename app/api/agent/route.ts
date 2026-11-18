import { NextRequest, NextResponse } from 'next/server';
import { processAgentPrompt } from '@/lib/gemini';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt, context } = body;

    // Input validation — apiKey is intentionally NOT accepted from client anymore
    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return NextResponse.json({ error: 'prompt is required and must be a non-empty string.' }, { status: 400 });
    }

    if (prompt.length > 2000) {
      return NextResponse.json({ error: 'prompt must be 2,000 characters or fewer.' }, { status: 400 });
    }

    // Lightweight context shape validation
    const safeContext = context && typeof context === 'object'
      ? {
          agents: Array.isArray(context.agents) ? context.agents.slice(0, 20) : [],
          subscriptions: Array.isArray(context.subscriptions) ? context.subscriptions.slice(0, 20) : [],
          contracts: Array.isArray(context.contracts) ? context.contracts.slice(0, 20) : [],
          recentTransactions: Array.isArray(context.recentTransactions)
            ? context.recentTransactions.slice(0, 5)
            : [],
        }
      : undefined;

    // Gemini key is read from process.env inside processAgentPrompt — not from client
    const result = await processAgentPrompt(prompt, safeContext);
    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error('[API] /api/agent error:', error);
    return NextResponse.json(
      { error: 'Agent processing failed. Please try again.' },
      { status: 500 }
    );
  }
}
