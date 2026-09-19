// Single source of truth for Code Pay's platform commission.
// Every place that creates a Payment must import this instead of
// recomputing the split inline.

export const PLATFORM_FEE_RATE = 0.1; // 10%

export function splitPayment(amount: number) {
  const platformFee = Math.round(amount * PLATFORM_FEE_RATE * 100) / 100;
  const developerAmount = Math.round((amount - platformFee) * 100) / 100;
  return { amount, platformFee, developerAmount };
}
