import { useEffect, useState, useCallback } from "react";
import { api } from "./api.js";
import { socket } from "./socket.js";

// Keeps a listings array in sync with the server: fetches once, then
// applies every socket event as it arrives so quantity/status changes
// (a claim elsewhere, a countdown hitting zero) show up instantly.
export function useRealtimeListings({ merchantName, includeAll = false } = {}) {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const data = merchantName
        ? await api.getMerchantListings(merchantName)
        : await api.getListings();
      setListings(data.listings);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [merchantName]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const belongsHere = (listing) => {
      if (!merchantName) return listing.status === "active" || includeAll;
      const q = String(merchantName).trim().toLowerCase();
      const mName = String(listing.merchantName || "").trim().toLowerCase();
      const mUser = String(listing.merchantUsername || "").trim().toLowerCase();
      const mId = String(listing.merchantId || "").trim().toLowerCase();

      if (mName === q || mUser === q || mId === q) return true;
      if (q.length >= 2) {
        if (mName.includes(q) || q.includes(mName) || mUser.includes(q) || q.includes(mUser)) return true;
        const qWords = q.split(/\s+/).filter((w) => w.length > 2);
        const mWords = mName.split(/\s+/).filter((w) => w.length > 2);
        if (qWords.some((qw) => mWords.some((mw) => mw.includes(qw) || qw.includes(mw)))) {
          return true;
        }
      }
      return false;
    };

    const upsert = (listing) => {
      setListings((prev) => {
        const exists = prev.some((l) => l.id === listing.id);
        if (!belongsHere(listing)) {
          return prev.filter((l) => l.id !== listing.id);
        }
        if (exists) return prev.map((l) => (l.id === listing.id ? listing : l));
        return [listing, ...prev];
      });
    };

    socket.on("listing:created", upsert);
    socket.on("listing:updated", upsert);
    socket.on("sync:snapshot", (snapshot) => {
      if (!merchantName) setListings(snapshot.listings);
    });

    return () => {
      socket.off("listing:created", upsert);
      socket.off("listing:updated", upsert);
      socket.off("sync:snapshot");
    };
  }, [merchantName, includeAll]);

  return { listings, loading, error, refresh };
}
