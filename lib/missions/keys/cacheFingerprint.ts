import { createHash } from "crypto";

export interface CacheFingerprintInput {
  stableKey: string;
  sourcePacketHash: string;
  familyTemplateVersion: string;
  benchmarkVersion: string;
}

/** Build the canonical cache fingerprint used for brief reuse and supersession. */
export function buildCacheFingerprint(input: CacheFingerprintInput): string {
  const raw = [
    input.stableKey,
    input.sourcePacketHash,
    input.familyTemplateVersion,
    input.benchmarkVersion,
  ].join("|");

  return createHash("sha256").update(raw).digest("hex");
}
