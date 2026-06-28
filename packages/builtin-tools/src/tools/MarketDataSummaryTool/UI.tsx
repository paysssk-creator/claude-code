import type React from 'react';

export function userFacingName(): string {
  return 'MarketDataSummary';
}

export function renderToolUseMessage(
  { csv }: Partial<{ csv: string }>,
  { verbose }: { verbose: boolean },
): React.ReactNode {
  if (!csv) return null;
  return `market data summary for ${verbose ? csv : (csv.split('/').pop() ?? csv)}`;
}

export function renderToolResultMessage(): React.ReactNode {
  return null;
}

export function renderToolUseErrorMessage(): React.ReactNode {
  return null;
}
