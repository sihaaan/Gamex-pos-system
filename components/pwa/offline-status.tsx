"use client";

import { Wifi, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";

export function OfflineStatus() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setOnline(navigator.onLine);
    }, 0);
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return (
    <Badge tone={online ? "success" : "warning"}>
      {online ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
      {online ? "Online" : "Draft / Not Posted"}
    </Badge>
  );
}
