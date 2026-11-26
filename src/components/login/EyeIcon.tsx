import { useId } from "react";

/**
 * Show / hide password icon.
 * Shape follows the two-tone eye icons; colours follow the soft
 * gradient icon style (light blue → mint white, bright blue iris).
 */
export default function EyeIcon({ hidden = false }: { hidden?: boolean }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const id = (name: string) => `${uid}-${name}`;

  return (
    <svg
      className="cs-eye-icon"
      viewBox="0 0 48 48"
      width="26"
      height="26"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={id("white")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#E4EEFF" />
          <stop offset="1" stopColor="#D2F0C8" />
        </linearGradient>
        <linearGradient id={id("shade")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#A9C8F5" />
          <stop offset="1" stopColor="#9ED6B0" />
        </linearGradient>
        <linearGradient id={id("iris")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7DBDFF" />
          <stop offset="1" stopColor="#2C7CF2" />
        </linearGradient>
        <linearGradient id={id("slash")} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#2C7CF2" />
          <stop offset="1" stopColor="#7DBDFF" />
        </linearGradient>
        <clipPath id={id("lens")}>
          <path d="M3.5 24 Q14 9 24 9 Q34 9 44.5 24 Q34 39 24 39 Q14 39 3.5 24 Z" />
        </clipPath>
      </defs>

      {/* eye shape, light top-right / shaded bottom-left */}
      <g clipPath={`url(#${id("lens")})`}>
        <rect x="0" y="0" width="48" height="48" fill={`url(#${id("white")})`} />
        <path
          d="M0 14 Q12 32 34 48 L0 48 Z"
          fill={`url(#${id("shade")})`}
          opacity="0.85"
        />
      </g>

      {/* iris, pupil and shine */}
      <circle cx="24" cy="24" r="9" fill={`url(#${id("iris")})`} />
      <circle cx="24" cy="24" r="4.2" fill="#163B37" opacity={hidden ? 0.55 : 0.85} />
      <circle cx="27" cy="20.6" r="1.8" fill="#FFFFFF" opacity="0.9" />

      {hidden && (
        <g strokeLinecap="round">
          {/* light gap so the slash reads clearly over the eye */}
          <line x1="12" y1="38" x2="37" y2="10" stroke="#FFFFFF" strokeWidth="6.5" />
          <line x1="12" y1="38" x2="37" y2="10" stroke={`url(#${id("slash")})`} strokeWidth="4" />
        </g>
      )}
    </svg>
  );
}
