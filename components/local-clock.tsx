"use client";

import { useEffect, useState } from "react";

/**
 * Renders nothing until mounted — the server has no business guessing
 * what time it is where you are.
 */
export function LocalClock({ timezone, city }: { timezone: string; city: string }) {
  const [now, setNow] = useState<string | null>(null);
  const [awake, setAwake] = useState(true);

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setNow(
        new Intl.DateTimeFormat("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: timezone,
          hour12: false,
        }).format(d),
      );
      const hour = Number(
        new Intl.DateTimeFormat("en-GB", {
          hour: "2-digit",
          timeZone: timezone,
          hour12: false,
        }).format(d),
      );
      setAwake(hour >= 8 && hour < 24);
    };
    tick();
    const id = setInterval(tick, 15_000);
    return () => clearInterval(id);
  }, [timezone]);

  if (!now) return <span className="mono" style={{ color: "var(--faint)" }}>{city}</span>;

  return (
    <span className="mono inline-flex items-center gap-1.5" style={{ color: "var(--faint)" }}>
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: awake ? "var(--signal)" : "var(--faint)" }}
        aria-hidden
      />
      {city} {now}
      <span className="hidden sm:inline">{awake ? "· awake" : "· asleep"}</span>
    </span>
  );
}
