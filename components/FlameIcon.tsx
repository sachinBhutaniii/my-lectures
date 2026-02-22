"use client";

interface FlameIconProps {
  size?: number;
  lit?: boolean;    // orange when lit, gray when not
  animated?: boolean; // pulsing glow animation
}

export default function FlameIcon({ size = 28, lit = true, animated = false }: FlameIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={[
        lit ? "flame-lit" : "flame-unlit",
        animated && lit ? "flame-animated" : "",
      ].join(" ")}
    >
      {/* Outer flame */}
      <path
        d="M12 2C12 2 7 7.5 7 12.5C7 15.54 9.24 18 12 18C14.76 18 17 15.54 17 12.5C17 10.04 15.16 8.01 13.28 6.28C13.87 8.11 13.5 9.5 12.5 10.5C12.5 10.5 12 8 12 2Z"
        fill={lit ? "#f97316" : "#4b5563"}
        opacity="0.9"
      />
      {/* Inner flame highlight */}
      <path
        d="M12 8C12 8 9.5 11 9.5 13.5C9.5 15.16 10.62 16.5 12 16.5C13.38 16.5 14.5 15.16 14.5 13.5C14.5 12.2 13.7 11.15 12.88 10.25C13.12 11.1 12.9 11.8 12.4 12.3C12.4 12.3 12 11 12 8Z"
        fill={lit ? "#fbbf24" : "#6b7280"}
        opacity="0.85"
      />
      {/* Core bright spot */}
      <ellipse
        cx="12"
        cy="14.5"
        rx="1.5"
        ry="2"
        fill={lit ? "#fef08a" : "#9ca3af"}
        opacity="0.7"
      />
    </svg>
  );
}
