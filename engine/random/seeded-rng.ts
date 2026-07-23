export interface RngResult<T> {
  value: T;
  state: number;
}

export function nextRandom(state: number): RngResult<number> {
  let value = state | 0;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  const next = value >>> 0 || 0x9e3779b9;
  return { value: next / 0x1_0000_0000, state: next };
}

export function shuffleDeterministic<T>(items: readonly T[], seed: number): RngResult<T[]> {
  const shuffled = [...items];
  let state = seed >>> 0 || 0x9e3779b9;
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const next = nextRandom(state);
    state = next.state;
    const target = Math.floor(next.value * (index + 1));
    [shuffled[index], shuffled[target]] = [shuffled[target]!, shuffled[index]!];
  }
  return { value: shuffled, state };
}

export function deriveSeed(baseSeed: number, sequence: number): number {
  let seed = (baseSeed + Math.imul(sequence + 1, 0x9e3779b9)) >>> 0;
  seed ^= seed >>> 16;
  seed = Math.imul(seed, 0x85ebca6b) >>> 0;
  seed ^= seed >>> 13;
  return seed >>> 0;
}
