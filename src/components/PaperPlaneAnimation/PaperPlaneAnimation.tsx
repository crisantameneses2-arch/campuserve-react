import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { frame, TOTAL, PALETTES } from "./paperPlaneEngine";

/**
 * <PaperPlaneAnimation />
 * A document lies down, folds into a paper airplane and flies away.
 * (TypeScript version of the component from PaperPlaneAnimation.zip.)
 *
 * Props
 *  - variant    'gradient' | 'flat' | 'soft'   (default 'gradient')
 *  - size       width/height in px or any CSS size (default 240)
 *  - duration   seconds for one full run (default 5)
 *  - loop       repeat forever (default true)
 *  - playing    start/stop the animation (default true)
 *  - onComplete called once when a non-looping run ends. Also called right
 *               away when the device asks for reduced motion, so screens
 *               waiting on it never get stuck.
 *  - className, style  passed to the wrapper
 */

type Variant = keyof typeof PALETTES;

type Props = {
  variant?: Variant;
  size?: number | string;
  duration?: number;
  loop?: boolean;
  playing?: boolean;
  onComplete?: () => void;
  /** Let the plane fly past the box and off the screen (longer flight, not clipped). */
  escape?: boolean;
  className?: string;
  style?: CSSProperties;
};

export default function PaperPlaneAnimation({
  variant = "gradient",
  size = 240,
  duration = 5,
  loop = true,
  playing = true,
  onComplete,
  escape = false,
  className,
  style,
}: Props) {
  const pal = PALETTES[variant] || PALETTES.gradient;
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, ""); // unique gradient ids per instance
  const [t, setT] = useState(0);
  const doneRef = useRef(onComplete);
  doneRef.current = onComplete;

  useEffect(() => {
    if (!playing) return undefined;

    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    if (reduce) {
      setT(0); // show the still document
      if (!loop) doneRef.current?.();
      return undefined;
    }

    let raf = 0;
    const start = performance.now();

    const tick = (now: number) => {
      const elapsed = (now - start) / 1000;

      if (!loop && elapsed >= duration * 0.93) {
        setT(TOTAL * 0.93); // plane has left the frame; rest on the empty frame
        doneRef.current?.();
        return;
      }

      setT(((elapsed % duration) / duration) * TOTAL);
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, loop, duration]);

  const f = frame(t, pal, escape ? 4 : 1);
  const id = (name: string) => `${uid}-${name}`;
  const fill = (value: string) =>
    value.replace(/url\(#dp(\w+)\)/, (_match, name: string) => `url(#${id(name)})`);

  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        background: pal.bg,
        display: "inline-block",
        overflow: escape ? "visible" : "hidden",
        ...style,
      }}
    >
      <svg
        viewBox="0 0 400 400"
        width="100%"
        height="100%"
        style={escape ? { overflow: "visible" } : undefined}
        role="img"
        aria-label="A document folds into a paper airplane and flies away"
      >
        <defs>
          <linearGradient id={id("F")} gradientUnits="userSpaceOnUse" x1={f.g.x} y1={f.g.y1} x2={f.g.x} y2={f.g.y2}>
            <stop offset="0" stopColor={pal.f0} />
            <stop offset="1" stopColor={pal.f1} />
          </linearGradient>
          <linearGradient id={id("B")} gradientUnits="userSpaceOnUse" x1={f.g.x} y1={f.g.y1} x2={f.g.x} y2={f.g.y2}>
            <stop offset="0" stopColor={pal.b0} />
            <stop offset="1" stopColor={pal.b1} />
          </linearGradient>
          <linearGradient id={id("Ear")} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={pal.ear0} />
            <stop offset="1" stopColor={pal.ear1} />
          </linearGradient>
          <linearGradient id={id("Pink")} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={pal.pink0} />
            <stop offset="1" stopColor={pal.pink1} />
          </linearGradient>
        </defs>

        {/* soft shadow on the ground */}
        <ellipse cx={f.shX} cy={f.shY} rx={f.shRx} ry="5" fill={pal.shadow} opacity={f.shOp} />

        <g opacity={f.op}>
          {/* paper faces, back to front; second polygon adds the light/shade */}
          {f.faces.map((p: { pts: string; fill: string; shade: string }, i: number) => (
            <g key={i}>
              <polygon
                points={p.pts}
                fill={fill(p.fill)}
                stroke={pal.ink || fill(p.fill)}
                strokeWidth={pal.sw}
                strokeLinejoin="round"
              />
              <polygon points={p.pts} fill={pal.shadeCol} opacity={p.shade} />
            </g>
          ))}

          {/* document details: corner curl, header tag, text lines, signature */}
          <g opacity={f.lineOp}>
            {f.decalPolys.map((d: { pts: string; fill: string; stroke: string }, i: number) => (
              <polygon
                key={`p${i}`}
                points={d.pts}
                fill={fill(d.fill)}
                stroke={d.stroke}
                strokeWidth="2"
                strokeLinejoin="round"
              />
            ))}
            {f.decalLines.map((d: { pts: string; stroke: string; sw: number }, i: number) => (
              <polyline
                key={`l${i}`}
                points={d.pts}
                fill="none"
                stroke={d.stroke}
                strokeWidth={d.sw}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
          </g>
        </g>

        {/* speed streaks while flying */}
        <g opacity={f.trail} stroke={pal.trail} strokeWidth="7" strokeLinecap="round" fill="none">
          <path d={f.trail1} />
          <path d={f.trail2} />
        </g>
      </svg>
    </div>
  );
}
