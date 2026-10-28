"use client";
import { useEffect, useState } from "react";
export function AssessmentCountdown({ deadline }: { deadline: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [deadline]);
  const left = Math.max(0, Math.ceil((deadline - now) / 1000));
  return (
    <span aria-label="Time remaining" className="font-mono">
      {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}
    </span>
  );
}
