/**
 * Generate a random alphanumeric invite code.
 * Uses crypto.getRandomValues for uniform distribution.
 * Works in both browser and Node.js environments.
 */
export function generateInviteCode(length = 6): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => chars[b % chars.length]).join("");
}
