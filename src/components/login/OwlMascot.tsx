import { useEffect, useRef } from "react";
import { OWL_SVG_INNER } from "./owlSvg";

/*
 * CampuServe owl mascot used on the login screens.
 * - Eyes follow the pointer.
 * - Eyes look away while a password field is focused.
 * - Blinks every few seconds.
 * - Flaps its wings when clicked.
 * Everything is cleaned up on unmount, and motion is skipped when the
 * user prefers reduced motion.
 */

type Eye = {
  pupil: Element | null;
  iris: Element | null;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  x: number;
  y: number;
};

export default function OwlMascot() {
  const svgRef = useRef<SVGSVGElement>(null);
  const busyRef = useRef(false);

  useEffect(() => {
    const owl = svgRef.current;

    if (!owl) return;

    const reduce =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const get = (id: string) => owl.querySelector(`#${id}`);

    const eyes: Eye[] = [
      { pupil: get("pupilR"), iris: get("irisR"), cx: 198, cy: 137, rx: 14, ry: 12, x: 0, y: 0 },
      { pupil: get("pupilL"), iris: get("irisL"), cx: 96, cy: 124, rx: 5, ry: 13, x: 0, y: 0 },
    ];

    let pointer: { x: number; y: number } | null = null;
    let frame = 0;
    let blinkTimer = 0;
    let stopped = false;

    function updateEyes() {
      if (stopped || !owl) return;

      const active = document.activeElement;
      const hide =
        active instanceof HTMLInputElement &&
        active.type === "password";

      const matrix = owl.getScreenCTM();
      let point: DOMPoint | null = null;

      if (matrix && pointer && !hide) {
        point = new DOMPoint(pointer.x, pointer.y).matrixTransform(
          matrix.inverse()
        );
      }

      eyes.forEach((eye) => {
        let tx = hide ? -eye.rx * 0.8 : 0;
        let ty = hide ? -eye.ry * 0.3 : 0;

        if (point) {
          const dx = point.x - eye.cx;
          const dy = point.y - eye.cy;
          const distance = Math.hypot(dx, dy) || 1;
          const strength = 1 - Math.exp(-distance / 70);

          tx = (dx / distance) * eye.rx * strength;
          ty = (dy / distance) * eye.ry * strength;
        }

        const k = reduce ? 1 : 0.18;

        eye.x += (tx - eye.x) * k;
        eye.y += (ty - eye.y) * k;

        eye.pupil?.setAttribute(
          "transform",
          `translate(${eye.x.toFixed(2)} ${eye.y.toFixed(2)})`
        );
        eye.iris?.setAttribute(
          "transform",
          `translate(${(eye.x * 0.35).toFixed(2)} ${(eye.y * 0.35).toFixed(2)})`
        );
      });

      if (!reduce) {
        frame = window.requestAnimationFrame(updateEyes);
      }
    }

    function handlePointer(event: PointerEvent) {
      pointer = { x: event.clientX, y: event.clientY };

      if (reduce) updateEyes();
    }

    function handleBlur() {
      pointer = null;
    }

    function blink() {
      if (document.hidden || reduce) return;

      ["L", "R"].forEach((side) => {
        get(`eye${side}`)?.animate(
          [
            { transform: "scaleY(1)" },
            { transform: "scaleY(.07)", offset: 0.45 },
            { transform: "scaleY(1)" },
          ],
          { duration: 170, easing: "ease-in-out" }
        );

        get(`lid${side}`)?.animate(
          [{ opacity: 0 }, { opacity: 1, offset: 0.45 }, { opacity: 0 }],
          { duration: 170 }
        );
      });
    }

    function scheduleBlink() {
      blinkTimer = window.setTimeout(() => {
        blink();
        scheduleBlink();
      }, 2600 + Math.random() * 3600);
    }

    window.addEventListener("pointermove", handlePointer, { passive: true });
    window.addEventListener("pointerdown", handlePointer, { passive: true });
    window.addEventListener("blur", handleBlur);

    if (!reduce) {
      frame = window.requestAnimationFrame(updateEyes);
      scheduleBlink();
    }

    return () => {
      stopped = true;
      window.cancelAnimationFrame(frame);
      window.clearTimeout(blinkTimer);
      window.removeEventListener("pointermove", handlePointer);
      window.removeEventListener("pointerdown", handlePointer);
      window.removeEventListener("blur", handleBlur);
    };
  }, []);

  function flap() {
    const owl = svgRef.current;

    if (!owl || busyRef.current) return;

    const reduce =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduce) return;

    busyRef.current = true;

    const frames = (sign: number) =>
      [0, 30, 3, 30, 0].map((angle) => ({
        transform: `rotate(${angle * sign}deg)`,
      }));

    owl.querySelector("#wingL")?.animate(frames(1), {
      duration: 850,
      easing: "ease-in-out",
    });

    const animation = owl.querySelector("#wingR")?.animate(frames(-1), {
      duration: 850,
      easing: "ease-in-out",
    });

    if (animation) {
      animation.onfinish = () => {
        busyRef.current = false;
      };
    } else {
      busyRef.current = false;
    }
  }

  return (
    <button
      className="owl-mascot"
      type="button"
      onClick={flap}
      aria-label="Make the CampuServe owl flap its wings"
    >
      <svg
        ref={svgRef}
        viewBox="0 0 345 523"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="CampuServe owl mascot"
        dangerouslySetInnerHTML={{ __html: OWL_SVG_INNER }}
      />
    </button>
  );
}
