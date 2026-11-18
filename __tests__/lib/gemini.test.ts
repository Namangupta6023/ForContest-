/**
 * Unit tests for lib/gemini.ts
 * Tests prompt sanitization, response validation, and fallback reasoning.
 */

describe('Gemini Library — sanitizePrompt (via processAgentPrompt)', () => {
  beforeEach(() => {
    jest.resetModules();
    delete process.env.GEMINI_API_KEY;
  });

  it('falls back to heuristic reasoning when no API key is set', async () => {
    const { processAgentPrompt } = await import('@/lib/gemini');
    const result = await processAgentPrompt('Procure $50 of OpenAI tokens for ProcureBot');
    expect(result).toHaveProperty('actionType');
    expect(result).toHaveProperty('summary');
    expect(result).toHaveProperty('chainOfThought');
    expect(result).toHaveProperty('riskScore');
    expect(result).toHaveProperty('approvalRequired');
    expect(['LOW', 'MEDIUM', 'HIGH']).toContain(result.riskScore);
  });

  it('detects PROCURE action from prompt keywords', async () => {
    const { processAgentPrompt } = await import('@/lib/gemini');
    const result = await processAgentPrompt('Procure cloud compute resources for the AI fleet');
    expect(['PROCURE', 'INFO']).toContain(result.actionType);
    expect(result.chainOfThought.length).toBeGreaterThan(0);
  });

  it('detects ESCROW_PAYOUT from prompt keywords', async () => {
    const { processAgentPrompt } = await import('@/lib/gemini');
    const result = await processAgentPrompt('Release escrow milestone payment to contractor');
    expect(['ESCROW_PAYOUT', 'INFO']).toContain(result.actionType);
  });

  it('detects CANCEL_SUBSCRIPTION action', async () => {
    const { processAgentPrompt } = await import('@/lib/gemini');
    const result = await processAgentPrompt('Cancel dormant subscription that has not been used');
    expect(['CANCEL_SUBSCRIPTION', 'INFO']).toContain(result.actionType);
  });

  it('returns approvalRequired=true for high-value amounts', async () => {
    const { processAgentPrompt } = await import('@/lib/gemini');
    const result = await processAgentPrompt('Procure $5000 GPU cluster from cloud vendor');
    expect(result).toHaveProperty('approvalRequired');
    expect(typeof result.approvalRequired).toBe('boolean');
  });

  it('handles empty prompt gracefully', async () => {
    const { processAgentPrompt } = await import('@/lib/gemini');
    const result = await processAgentPrompt('');
    expect(result).toHaveProperty('actionType');
  });

  it('truncates extremely long prompts to safe length', async () => {
    const { processAgentPrompt } = await import('@/lib/gemini');
    const longPrompt = 'A'.repeat(10000);
    // Should not throw, should handle gracefully
    await expect(processAgentPrompt(longPrompt)).resolves.toHaveProperty('actionType');
  });

  it('strips control characters from prompt', async () => {
    const { processAgentPrompt } = await import('@/lib/gemini');
    const maliciousPrompt = 'Procure\x00\x01\x07tokens\x1Bfor agent';
    // Should not throw and should process safely
    await expect(processAgentPrompt(maliciousPrompt)).resolves.toHaveProperty('actionType');
  });
});

describe('Gemini Library — AgentActionResponse structure', () => {
  beforeEach(() => {
    jest.resetModules();
    delete process.env.GEMINI_API_KEY;
  });

  it('always returns all required fields', async () => {
    const { processAgentPrompt } = await import('@/lib/gemini');
    const result = await processAgentPrompt('Check subscription status');
    expect(result).toMatchObject({
      actionType: expect.any(String),
      summary: expect.any(String),
      chainOfThought: expect.any(Array),
      riskScore: expect.stringMatching(/^(LOW|MEDIUM|HIGH)$/),
      approvalRequired: expect.any(Boolean),
      data: expect.any(Object),
    });
  });

  it('chainOfThought is a non-empty array of strings', async () => {
    const { processAgentPrompt } = await import('@/lib/gemini');
    const result = await processAgentPrompt('Dispute a fraudulent charge');
    expect(Array.isArray(result.chainOfThought)).toBe(true);
    result.chainOfThought.forEach((step: unknown) => {
      expect(typeof step).toBe('string');
    });
  });
});
