/** Parses "4.7k", "10m", "2.2e-3", "1 µ" etc. */
export function parseValue(text: string): number {
  const t = text.trim().replace(/\s+/g, '').replace(/[ΩVAWvaw]$/u, '')
  const m = t.match(/^([-+−]?\d*\.?\d+(?:e[-+]?\d+)?)([pnuµmkMG]?)$/i)
  if (!m) return Number.NaN
  const num = Number(m[1].replace('−', '-'))
  const mult: Record<string, number> = { p: 1e-12, n: 1e-9, u: 1e-6, µ: 1e-6, m: 1e-3, k: 1e3, K: 1e3, M: 1e6, G: 1e9, '': 1 }
  return num * (mult[m[2]] ?? 1)
}
