import { describe, expect, it } from "vitest";
import { deriveSeed, nextRandom, shuffleDeterministic } from "../../engine/random/seeded-rng";

describe("seeded RNG", () => {
  it("produces a consistent sequence", () => {
    const first = nextRandom(12345);
    const second = nextRandom(first.state);
    expect([first.value, second.value]).toEqual([0.776938705239445, 0.3951726963277906]);
    expect(deriveSeed(99, 4)).toBe(3815569304);
  });

  it("shuffles deterministically without mutating input", () => {
    const input = [1, 2, 3, 4, 5, 6];
    const a = shuffleDeterministic(input, 77);
    const b = shuffleDeterministic(input, 77);
    expect(a).toEqual(b);
    expect(a.value).not.toEqual(input);
    expect(input).toEqual([1, 2, 3, 4, 5, 6]);
  });
});
