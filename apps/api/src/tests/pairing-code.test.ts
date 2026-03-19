import { describe, it, expect } from "vitest";
import { generatePairingCode6 } from "../modules/devices/devices.service.js";

describe("generatePairingCode6", () => {
  it("should generate a 6-character string", () => {
    const code = generatePairingCode6();
    expect(code).toHaveLength(6);
  });

  it("should only contain allowed characters (A-Z excluding I/O, 2-9 excluding 0/1)", () => {
    const allowed = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    for (let i = 0; i < 100; i++) {
      const code = generatePairingCode6();
      for (const char of code) {
        expect(allowed).toContain(char);
      }
    }
  });

  it("should generate different codes on successive calls (probabilistic)", () => {
    const codes = new Set<string>();
    for (let i = 0; i < 50; i++) {
      codes.add(generatePairingCode6());
    }
    // With 30^6 = 729M possible codes, 50 draws should give ~50 unique
    expect(codes.size).toBeGreaterThan(40);
  });

  it("should never contain ambiguous characters I, O, 0, 1", () => {
    for (let i = 0; i < 200; i++) {
      const code = generatePairingCode6();
      expect(code).not.toMatch(/[IO01]/);
    }
  });
});
