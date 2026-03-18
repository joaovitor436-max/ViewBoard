import { randomBytes, createHash } from "crypto";

/**
 * Generates a human-readable pairing code (e.g. "ALPHA-1234")
 * used for screen registration on first boot.
 */
export function generatePairingCode(): string {
  const words = [
    "ALPHA", "BRAVO", "CHARLIE", "DELTA", "ECHO",
    "FOXTROT", "GOLF", "HOTEL", "INDIA", "JULIET",
    "KILO", "LIMA", "MIKE", "NOVEMBER", "OSCAR",
    "PAPA", "QUEBEC", "ROMEO", "SIERRA", "TANGO",
  ];
  const word = words[Math.floor(Math.random() * words.length)] as string;
  const digits = Math.floor(1000 + Math.random() * 9000).toString();
  return `${word}-${digits}`;
}

/**
 * Generates a cryptographically secure secret key for screen authentication.
 */
export function generateScreenSecretKey(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Derives a deterministic pairing token from screenId + secretKey.
 * Used to validate pairing requests without storing plaintext secrets.
 */
export function derivePairingToken(screenId: string, secretKey: string): string {
  return createHash("sha256")
    .update(`${screenId}:${secretKey}`)
    .digest("hex");
}
