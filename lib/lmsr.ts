export function lmsrProb(qValues: number[], optionIndex: number, b: number): number {
  const exps = qValues.map(q => Math.exp(q / b))
  const total = exps.reduce((a, v) => a + v, 0)
  return exps[optionIndex] / total
}

export function newQValues(qValues: number[], optionIndex: number, amount: number): number[] {
  return qValues.map((q, i) => (i === optionIndex ? q + amount : q))
}

export function lmsrCost(qValues: number[], b: number): number {
  return b * Math.log(qValues.reduce((sum, q) => sum + Math.exp(q / b), 0))
}

export function formatProbability(prob: number): string {
  return `${(prob * 100).toFixed(1)}%`
}
