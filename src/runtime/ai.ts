/**
 * The one AI interface the app talks to. Today it's Claude through the
 * artifact `sample` capability, which runs on the viewer's own Claude plan.
 * Moving to a server means another implementation that calls the Claude API.
 *
 * Every call sends the instructions, the data and the exact shape wanted back
 * (SPEC section 9). There is no conversation memory between calls.
 */

/** quick: short, cheap answers (summaries). default: most features. complex: hardest reasoning. */
export type Tier = 'quick' | 'default' | 'complex';

export interface AI {
  /** Ask for JSON; resolves the parsed value. */
  json<T>(prompt: string, tier?: Tier): Promise<T>;
  /** Ask for plain text. */
  text(prompt: string, tier?: Tier): Promise<string>;
}

/** Why an AI call failed, in words for the person using the app. */
export function aiErrorMessage(e: unknown): string | null {
  const code = (e as { code?: string } | null)?.code;
  if (code === 'cancelled') return null;
  if (
    code === 'not_granted' ||
    code === 'sampling_disabled' ||
    code === 'not_declared' ||
    code === 'capability_disabled' ||
    code === 'capability_removed'
  )
    return 'AI is turned off for this page. You can allow it from the page’s permissions.';
  if (code === 'rate_limited') return 'AI is busy or you hit a usage limit. Try again in a bit.';
  if (code === 'invalid_json')
    return "The AI's answer didn't come back in the right shape. Try again.";
  if (code === 'prompt_too_large')
    return 'That’s too much for the AI at once. Try something shorter.';
  return "The AI didn't answer. Try again.";
}

export function createClaudeAI(sample: typeof Claude.sample): AI {
  // Answers depend on live data, so never reuse a cached answer.
  return {
    json: <T>(prompt: string, tier: Tier = 'default') =>
      sample.json<T>(prompt, { modelTier: tier, cache: false }),
    text: async (prompt: string, tier: Tier = 'default') =>
      (await sample(prompt, { modelTier: tier, cache: false })).text,
  };
}
