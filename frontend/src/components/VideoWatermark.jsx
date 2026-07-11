import React, { useEffect, useState } from "react";

/**
 * Floating watermark overlay for protected video content.
 * Renders student name, email and current timestamp.
 * Position drifts via CSS animation (wm-float).
 * Refreshes time every second so screen-recording reveals tampering.
 */
export default function VideoWatermark({ name, email }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const dateStr = now.toLocaleDateString();
  const timeStr = now.toLocaleTimeString();

  return (
    <>
      {/* Floating diagonal watermark */}
      <div className="video-watermark" data-testid="video-watermark">
        <div>{name}</div>
        <div className="opacity-90">{email}</div>
        <div className="opacity-80">{dateStr} • {timeStr}</div>
      </div>
      {/* Static corner badge */}
      <div
        className="absolute top-2 right-2 px-2 py-1 rounded-md text-[10px] sm:text-xs font-semibold bg-black/40 text-white/90 backdrop-blur-sm pointer-events-none"
        data-testid="video-watermark-corner"
      >
        {name} • {email}
      </div>
    </>
  );
}
