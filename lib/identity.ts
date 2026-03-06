const IDENTITY_KEY = "focusparty-identity";

export interface AnonIdentity {
  id: string;
  displayName: string;
}

/** Get or create a persistent anonymous identity from localStorage. */
export function getIdentity(): AnonIdentity {
  if (typeof window === "undefined") {
    return { id: "server", displayName: "Guest" };
  }
  try {
    const stored = localStorage.getItem(IDENTITY_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as AnonIdentity;
      if (parsed.id && parsed.displayName) return parsed;
    }
  } catch {
    /* ignore */
  }

  const identity: AnonIdentity = {
    id: crypto.randomUUID(),
    displayName: "Guest",
  };
  saveIdentity(identity);
  return identity;
}

export function saveIdentity(identity: AnonIdentity): void {
  try {
    localStorage.setItem(IDENTITY_KEY, JSON.stringify(identity));
  } catch {
    /* ignore */
  }
}

export function updateDisplayName(name: string): AnonIdentity {
  const identity = getIdentity();
  identity.displayName = name.trim() || "Guest";
  saveIdentity(identity);
  return identity;
}
