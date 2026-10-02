import { describe, expect, it } from "vitest";
import { compareHref, parseCompareIds, parseCompareMode } from "@/lib/compare";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const C = "33333333-3333-4333-8333-333333333333";
const D = "44444444-4444-4444-8444-444444444444";
const E = "55555555-5555-4555-8555-555555555555";

describe("parseCompareIds", () => {
  it("houdt de volgorde, haalt dubbele en ongeldige id's weg", () => {
    expect(parseCompareIds([B, "x", A, B])).toEqual([B, A]);
    expect(parseCompareIds(A)).toEqual([A]);
    expect(parseCompareIds(undefined)).toEqual([]);
  });

  it("hooguit vier scripts", () => {
    expect(parseCompareIds([A, B, C, D, E])).toEqual([A, B, C, D]);
  });
});

describe("parseCompareMode", () => {
  it("alleen overhoren als dat er staat; anders lezen", () => {
    expect(parseCompareMode("overhoren")).toBe("overhoren");
    expect(parseCompareMode(undefined)).toBe("lezen");
    expect(parseCompareMode(["overhoren"])).toBe("lezen");
  });
});

describe("compareHref", () => {
  it("zet id's en modus in de URL", () => {
    expect(compareHref([A, B], "lezen")).toBe(`/scripts/vergelijk?id=${A}&id=${B}`);
    expect(compareHref([A, B], "overhoren")).toBe(`/scripts/vergelijk?id=${A}&id=${B}&modus=overhoren`);
    expect(compareHref([], "lezen")).toBe("/scripts/vergelijk");
  });

  it("toevoegen boven de vier en dubbel toevoegen veranderen niets", () => {
    expect(compareHref([A, B, C, D, E], "lezen")).toBe(compareHref([A, B, C, D], "lezen"));
    expect(compareHref([A, B, A], "lezen")).toBe(compareHref([A, B], "lezen"));
  });
});
