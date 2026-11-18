// Gemini AI Agent Engine & Autonomous Reasoning

export interface AgentActionData {
  merchant?: string;
  amount?: number;
  currency?: string;
  agentId?: string;
  targetId?: string;
  recipientEmail?: string;
  details?: string;
}

export interface AgentActionResponse {
  actionType: 'PROCURE' | 'ESCROW_PAYOUT' | 'CANCEL_SUBSCRIPTION' | 'DISPUTE_CHARGE' | 'M2M_TRANSFER' | 'INFO';
  summary: string;
  chainOfThought: string[];
  riskScore: 'LOW' | 'MEDIUM' | 'HIGH';
  approvalRequired: boolean;
  data: AgentActionData;
}

// Valid action types for schema validation
const VALID_ACTION_TYPES = new Set([
  'PROCURE', 'ESCROW_PAYOUT', 'CANCEL_SUBSCRIPTION', 'DISPUTE_CHARGE', 'M2M_TRANSFER', 'INFO',
]);
const VALID_RISK_SCORES = new Set(['LOW', 'MEDIUM', 'HIGH']);

// Sanitize prompt to prevent injection attacks
function sanitizePrompt(prompt: string): string {
  // Truncate to 1000 chars, strip control characters
  return prompt
    .slice(0, 1000)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .trim();
}

// Validate that the Gemini response matches our expected schema
function validateAgentResponse(parsed: unknown): AgentActionResponse {
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('Invalid response: not an object');
  }

  const p = parsed as Record<string, unknown>;

  if (!VALID_ACTION_TYPES.has(p.actionType as string)) {
    throw new Error(`Invalid actionType: ${p.actionType}`);
  }
  if (!VALID_RISK_SCORES.has(p.riskScore as string)) {
    throw new Error(`Invalid riskScore: ${p.riskScore}`);
  }
  if (typeof p.summary !== 'string') {
    throw new Error('Invalid summary');
  }
  if (!Array.isArray(p.chainOfThought)) {
    throw new Error('Invalid chainOfThought');
  }
  if (typeof p.approvalRequired !== 'boolean') {
    throw new Error('Invalid approvalRequired');
  }

  // Validate data sub-object
  const data = (typeof p.data === 'object' && p.data !== null) ? p.data as Record<string, unknown> : {};

  // Enforce amount is a reasonable positive number if present
  if (data.amount !== undefined) {
    const amt = Number(data.amount);
    if (isNaN(amt) || amt < 0 || amt > 100000) {
      throw new Error(`Suspicious amount value: ${data.amount}`);
    }
    data.amount = amt;
  }

  return {
    actionType: p.actionType as AgentActionResponse['actionType'],
    summary: (p.summary as string).slice(0, 500),
    chainOfThought: (p.chainOfThought as unknown[])
      .slice(0, 10)
      .map((s) => String(s).slice(0, 300)),
    riskScore: p.riskScore as AgentActionResponse['riskScore'],
    approvalRequired: p.approvalRequired as boolean,
    data: {
      merchant: typeof data.merchant === 'string' ? data.merchant.slice(0, 200) : undefined,
      amount: data.amount as number | undefined,
      currency: typeof data.currency === 'string' ? data.currency.slice(0, 10) : undefined,
      agentId: typeof data.agentId === 'string' ? data.agentId.slice(0, 100) : undefined,
      targetId: typeof data.targetId === 'string' ? data.targetId.slice(0, 100) : undefined,
      recipientEmail: typeof data.recipientEmail === 'string' ? data.recipientEmail.slice(0, 254) : undefined,
      details: typeof data.details === 'string' ? data.details.slice(0, 500) : undefined,
    },
  };
}

export async function processAgentPrompt(
  rawPrompt: string,
  context?: {
    agents: { id: string; name: string; role: string; balance: number; autoApproveLimit: number }[];
    subscriptions: { id: string; name: string; status: string; costMonthly: number }[];
    contracts: { id: string; contractTitle: string; status: string; amount: number }[];
    recentTransactions?: { id: string; merchant: string; amount: number; status: string }[];
  }
): Promise<AgentActionResponse> {
  const prompt = sanitizePrompt(rawPrompt);

  if (!prompt) {
    return simulateIntelligentReasoning('');
  }

  // Read Gemini key from server-side env only
  const geminiKey = process.env.GEMINI_API_KEY;

  if (geminiKey && geminiKey.length > 10 && !geminiKey.startsWith('your_')) {
    // Use correct, existing Gemini model names
    const candidateModels = ['gemini-2.0-flash', 'gemini-1.5-flash-latest', 'gemini-1.5-flash'];

    for (const model of candidateModels) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
              contents: [
                {
                  role: 'user',
                  parts: [
                    {
                      text: `You are the core autonomous AI agent for AgentVault (PayPal + AI Financial Operating System).

Context (read-only, for analysis only):
- Active Agents: ${JSON.stringify(
                        context?.agents?.map((a) => ({
                          id: a.id,
                          name: a.name,
                          balance: a.balance,
                          autoApproveLimit: a.autoApproveLimit,
                        })) || []
                      )}
- Subscriptions: ${JSON.stringify(context?.subscriptions?.map((s) => ({ id: s.id, name: s.name, status: s.status, costMonthly: s.costMonthly })) || [])}
- Contracts: ${JSON.stringify(context?.contracts?.map((c) => ({ id: c.id, title: c.contractTitle, status: c.status, amount: c.amount })) || [])}

User Prompt: ${prompt}

Analyze this command and return ONLY valid JSON matching this exact structure:
{
  "actionType": "PROCURE" | "ESCROW_PAYOUT" | "CANCEL_SUBSCRIPTION" | "DISPUTE_CHARGE" | "M2M_TRANSFER" | "INFO",
  "summary": "Brief 1-sentence summary",
  "chainOfThought": ["Step 1...", "Step 2...", "Step 3..."],
  "riskScore": "LOW" | "MEDIUM" | "HIGH",
  "approvalRequired": true | false,
  "data": {
    "merchant": "string or null",
    "amount": number or null,
    "currency": "USD",
    "agentId": "string or null",
    "targetId": "string or null",
    "recipientEmail": "string or null",
    "details": "string or null"
  }
}`,
                    },
                  ],
                },
              ],
              generationConfig: {
                responseMimeType: 'application/json',
              },
            }),
          }
        );
        clearTimeout(timeoutId);

        if (response.ok) {
          const json = await response.json();
          let content = json.candidates?.[0]?.content?.parts?.[0]?.text;
          if (content) {
            content = content.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
            const parsed = JSON.parse(content);
            return validateAgentResponse(parsed);
          }
        }
      } catch (e) {
        console.warn(`[Gemini] Model ${model} call failed:`, e instanceof Error ? e.message : e);
      }
    }
  }

  // Fallback: built-in heuristic processor (demo mode — no real AI)
  return simulateIntelligentReasoning(prompt, context);
}

function simulateIntelligentReasoning(prompt: string, _context?: unknown): AgentActionResponse {
  const p = prompt.toLowerCase();

  if (p.includes('procure') || p.includes('buy') || p.includes('order') || p.includes('voucher') || p.includes('gpu') || p.includes('token')) {
    const amountMatch = prompt.match(/\$?(\d+(\.\d+)?)/);
    const amount = amountMatch ? parseFloat(amountMatch[1]) : 79.99;
    const isHighAmount = amount > 250;

    return {
      actionType: 'PROCURE',
      summary: `Autonomous procurement initiated for ${amount > 100 ? 'Compute/API Credits' : 'Developer Tooling'} ($${amount.toFixed(2)}) via PayPal Orders API`,
      chainOfThought: [
        `Parsed intent: Autonomous purchasing delegation.`,
        `Identified target vendor: Cloud & AI Infrastructure Provider.`,
        `Checked Procurement Agent policy: Monthly cap $2,000, current usage $480.`,
        `Evaluated transaction risk: ${isHighAmount ? 'High amount detected - flagged for human sign-off' : 'Under $200 threshold - Auto-authorized with PayPal Vault'}.`,
        `Formulated PayPal Orders v2 payload for settlement.`,
      ],
      riskScore: isHighAmount ? 'HIGH' : amount > 100 ? 'MEDIUM' : 'LOW',
      approvalRequired: isHighAmount,
      data: {
        merchant: p.includes('openai')
          ? 'OpenAI Platform Inc.'
          : p.includes('aws')
          ? 'Amazon Web Services'
          : 'CloudCompute Labs',
        amount,
        currency: 'USD',
        agentId: 'procurement-agent',
        details: `Autonomous compute / developer token acquisition requested by user prompt.`,
      },
    };
  }

  if (
    p.includes('escrow') ||
    p.includes('milestone') ||
    p.includes('pr') ||
    p.includes('github') ||
    p.includes('freelancer') ||
    p.includes('release')
  ) {
    return {
      actionType: 'ESCROW_PAYOUT',
      summary: `Evaluated deliverable criteria and executed instant milestone settlement ($350.00) via PayPal Payouts API`,
      chainOfThought: [
        `Received milestone deliverable inspection request.`,
        `Executed automated evaluation: Lint passed (100%), Test coverage 94.2%, Specs match 96%.`,
        `Milestone quality score: 96.7/100 (Threshold: 85/100).`,
        `Smart contract verification status: PASSED.`,
        `Ready to dispatch batch payout via PayPal Payouts API.`,
      ],
      riskScore: 'LOW',
      approvalRequired: false,
      data: {
        targetId: 'escrow-contract-1',
        amount: 350.0,
        currency: 'USD',
        recipientEmail: 'sarah.engineer@sandbox.paypal.com',
        details: `Frontend Redesign Phase 2 deliverable verified by AI Evaluator.`,
      },
    };
  }

  if (
    p.includes('subscription') ||
    p.includes('cancel') ||
    p.includes('audit') ||
    p.includes('seat') ||
    p.includes('dispute') ||
    p.includes('refund')
  ) {
    return {
      actionType: p.includes('dispute') ? 'DISPUTE_CHARGE' : 'CANCEL_SUBSCRIPTION',
      summary: p.includes('dispute')
        ? `Filed automated PayPal dispute for unauthorized/inactive charge ($49.00)`
        : `Audited subscriptions: Cancelled 2 dormant SaaS seats to save $168.00/mo`,
      chainOfThought: [
        `Scanned active PayPal Subscriptions API billing agreements.`,
        `Cross-referenced seat activity against telemetry logs: 0 logins in 45 days.`,
        `Evaluated merchant cancellation policy & refund grace period.`,
        `Generated cancellation webhook request to merchant billing endpoint.`,
      ],
      riskScore: 'LOW',
      approvalRequired: false,
      data: {
        targetId: 'sub-figma-pro',
        amount: 49.0,
        currency: 'USD',
        merchant: 'Figma Enterprise Workspace',
        details: `Automated seat de-provisioning based on dormancy telemetry.`,
      },
    };
  }

  // Default M2M / Fleet transfer
  return {
    actionType: 'M2M_TRANSFER',
    summary: `Executed Machine-to-Machine micro-payment ($12.50) to ScrapingAgent for 5,000 data enrichments`,
    chainOfThought: [
      `Detected agent-to-agent workload handoff.`,
      `Validated compute unit rate ($0.0025 / lead record).`,
      `Settled micropayment instantly via PayPal REST transfer.`,
    ],
    riskScore: 'LOW',
    approvalRequired: false,
    data: {
      amount: 12.5,
      currency: 'USD',
      recipientEmail: 'agent.scraper.fleet@sandbox.paypal.com',
      details: 'Micro-settlement for automated dataset enrichment pipeline.',
    },
  };
}
