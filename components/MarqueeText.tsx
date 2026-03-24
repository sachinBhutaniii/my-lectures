"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  text: string;
  className?: string;
  /** Seconds for one full scroll cycle. Default 14s. */
  speed?: number;
}

/**
 * Renders text in a single line. If the text overflows the container,
 * it auto-scrolls horizontally in a seamless marquee loop.
 */
export default function MarqueeText({ text, className = "", speed = 14 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const spanRef = useRef<HTMLSpanElement>(null);
  const [scrolls, setScrolls] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    const span = spanRef.current;
    if (!container || !span) return;
    // Small timeout so layout is complete before measuring
    const id = setTimeout(() => {
      setScrolls(span.scrollWidth > container.offsetWidth + 2);
    }, 80);
    return () => clearTimeout(id);
  }, [text]);

  return (
    <div ref={containerRef} className={`overflow-hidden ${className}`}>
      {scrolls ? (
        <div className="marquee-track" style={{ animationDuration: `${speed}s` }}>
          <span className="whitespace-nowrap pr-10">{text}</span>
          <span className="whitespace-nowrap pr-10" aria-hidden>{text}</span>
        </div>
      ) : (
        <span ref={spanRef} className="whitespace-nowrap block">{text}</span>
      )}
    </div>
  );
}
