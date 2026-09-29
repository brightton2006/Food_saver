function getStorageKey(userId) {
  const targetId = userId || (function () {
    try {
      const raw = localStorage.getItem("foodsaver_session") || localStorage.getItem("foodsaver.session");
      const sess = raw ? JSON.parse(raw) : null;
      return sess?.userId || sess?.id || sess?.username || sess?.email || "guest";
    } catch {
      return "guest";
    }
  })();
  return `foodsaver.myClaims.${targetId}`;
}

export function getMyClaims(userId) {
  try {
    const allClaimsMap = new Map();
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("foodsaver.myClaims.")) {
        try {
          const items = JSON.parse(localStorage.getItem(k) || "[]");
          if (Array.isArray(items)) {
            items.forEach((c) => {
              if (c && c.token) allClaimsMap.set(c.token, c);
            });
          }
        } catch {}
      }
    }
    const merged = Array.from(allClaimsMap.values()).sort((a, b) => (b.claimedAt || 0) - (a.claimedAt || 0));
    return merged;
  } catch {
    return [];
  }
}

export function addMyClaim(claim, userId) {
  if (!claim || !claim.token) return;
  const key = getStorageKey(userId);
  const claims = getMyClaims(userId);
  const updated = [claim, ...claims.filter((c) => c.token !== claim.token)];
  localStorage.setItem(key, JSON.stringify(updated));
}

export function updateMyClaim(token, patch, userId) {
  const key = getStorageKey(userId);
  const claims = getMyClaims(userId).map((c) => (c.token === token ? { ...c, ...patch } : c));
  localStorage.setItem(key, JSON.stringify(claims));
}
