import { useEffect, useState, useCallback } from "react";
import { api } from "./api.js";
import { socket } from "./socket.js";

export function useNgoNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const data = await api.getNgoNotifications();
    setNotifications(data.notifications);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const onNew = (n) => setNotifications((prev) => [n, ...prev]);
    const onAck = (n) =>
      setNotifications((prev) => prev.map((item) => (item.id === n.id ? n : item)));

    socket.on("ngo:notification", onNew);
    socket.on("ngo:acknowledged", onAck);
    return () => {
      socket.off("ngo:notification", onNew);
      socket.off("ngo:acknowledged", onAck);
    };
  }, []);

  return { notifications, loading, refresh };
}
