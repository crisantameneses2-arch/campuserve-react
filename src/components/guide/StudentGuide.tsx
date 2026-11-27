import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import type { GuidePage, GuideStep } from "./guideSteps";
import "./StudentGuide.css";

/*
 * Spotlight walkthrough for the student dashboard.
 * Dims the screen, cuts a lit "hole" around the real element the step is
 * about, pulses it, and shows a card that explains it. Steps can open a
 * dashboard page first, and open the phone menu for sidebar items.
 */

type Rect = { top: number; left: number; width: number; height: number };

const PAD = 8; // space around the highlighted element

export default function StudentGuide({
  steps,
  onClose,
  onNavigate,
  onMenu,
}: {
  steps: GuideStep[];
  onClose: () => void;
  onNavigate: (page: GuidePage) => void;
  /** Open (true) or close (false) the sidebar menu on phones. */
  onMenu: (open: boolean) => void;
}) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [ready, setReady] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const [cardSize, setCardSize] = useState({ width: 320, height: 180 });
  const menuOpenedRef = useRef(false);

  const step = steps[index];
  const isLast = index === steps.length - 1;

  const finish = useCallback(() => {
    if (menuOpenedRef.current) onMenu(false);
    onClose();
  }, [onClose, onMenu]);

  /* ---- move to the step: open its page / menu, find its element ---- */
  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setRect(null);

    if (step.page) onNavigate(step.page);

    // Close the phone menu again once we leave the sidebar steps.
    if (!step.nav && menuOpenedRef.current) {
      onMenu(false);
      menuOpenedRef.current = false;
    }

    const started = performance.now();

    const findTarget = () => {
      if (cancelled) return;

      if (!step.target) {
        setReady(true);
        return;
      }

      const element = document.querySelector<HTMLElement>(step.target);
      const box = element?.getBoundingClientRect();
      const visible =
        box &&
        box.width > 0 &&
        box.height > 0 &&
        box.right > 4 &&
        box.left < window.innerWidth - 4;

      // A sidebar item that is off-screen → the phone menu is closed.
      if (element && step.nav && !visible && !menuOpenedRef.current) {
        onMenu(true);
        menuOpenedRef.current = true;
      }

      if (element && visible) {
        element.scrollIntoView({ block: "center", behavior: "smooth" });
        // wait for scrolling / the menu sliding in, then show
        window.setTimeout(() => !cancelled && setReady(true), 380);
        return;
      }

      if (performance.now() - started > 2200) {
        // Not on screen (e.g. no transactions yet): show the card alone.
        setReady(true);
        return;
      }

      window.setTimeout(findTarget, 120);
    };

    // let the page render first
    const timer = window.setTimeout(findTarget, step.page ? 260 : 40);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  /* ---- follow the element while it moves (scroll, resize, menu) ---- */
  useEffect(() => {
    if (!ready || !step.target) return undefined;

    let raf = 0;
    const tick = () => {
      const element = document.querySelector<HTMLElement>(step.target!);
      const box = element?.getBoundingClientRect();

      if (box && box.width > 0 && box.height > 0) {
        setRect((previous) =>
          previous &&
          Math.abs(previous.top - box.top) < 0.5 &&
          Math.abs(previous.left - box.left) < 0.5 &&
          Math.abs(previous.width - box.width) < 0.5 &&
          Math.abs(previous.height - box.height) < 0.5
            ? previous
            : { top: box.top, left: box.left, width: box.width, height: box.height }
        );
      } else {
        setRect(null);
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [ready, step.target]);

  /* ---- card size, for placing it next to the element ---- */
  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    const box = card.getBoundingClientRect();
    if (Math.abs(box.width - cardSize.width) > 1 || Math.abs(box.height - cardSize.height) > 1) {
      setCardSize({ width: box.width, height: box.height });
    }
  });

  /* ---- keyboard ---- */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") finish();
      if (event.key === "ArrowRight" || event.key === "Enter") {
        event.preventDefault();
        if (isLast) finish();
        else setIndex((value) => value + 1);
      }
      if (event.key === "ArrowLeft" && index > 0) setIndex((value) => value - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [finish, index, isLast]);

  // Make sure the menu closes if the guide is removed mid-way.
  useEffect(
    () => () => {
      if (menuOpenedRef.current) onMenu(false);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  /* ---- layout ---- */
  const vw = typeof window !== "undefined" ? window.innerWidth : 1024;
  const vh = typeof window !== "undefined" ? window.innerHeight : 768;
  const hole = rect
    ? {
        top: rect.top - PAD,
        left: rect.left - PAD,
        width: rect.width + PAD * 2,
        height: rect.height + PAD * 2,
      }
    : null;

  let cardStyle: CSSProperties;

  if (!hole) {
    cardStyle = {
      top: Math.max(16, vh / 2 - cardSize.height / 2),
      left: Math.max(12, vw / 2 - cardSize.width / 2),
    };
  } else {
    const gap = 14;
    // leave room for the "Tap here" label under the element
    const tapRoom = step.tap ? 40 : 0;
    const below = hole.top + hole.height + gap + tapRoom;
    const above = hole.top - gap - cardSize.height - (step.tap ? 0 : 0);
    const fitsBelow = below + cardSize.height < vh - 12;
    const fitsAbove = above > 12;
    // Beside the element (laptop sidebar items) when there is room.
    const besideLeft = hole.left + hole.width + gap;
    const fitsBeside = besideLeft + cardSize.width < vw - 12 && hole.width < vw * 0.4;

    let top: number;
    let left: number;

    if (step.nav && fitsBeside) {
      left = besideLeft;
      top = Math.min(Math.max(12, hole.top + hole.height / 2 - cardSize.height / 2), vh - cardSize.height - 12);
    } else {
      top = fitsBelow ? below : fitsAbove ? above : Math.max(12, vh - cardSize.height - 12);
      left = Math.min(
        Math.max(12, hole.left + hole.width / 2 - cardSize.width / 2),
        vw - cardSize.width - 12
      );
    }

    cardStyle = { top, left };
  }

  return (
    <div className="sgd" role="dialog" aria-modal="true" aria-labelledby="sgd-title">
      {/* dim layer; the hole lets the real element show through */}
      {hole && ready ? (
        <div
          className="sgd-hole"
          style={{ top: hole.top, left: hole.left, width: hole.width, height: hole.height }}
        >
          <span className="sgd-ring" aria-hidden="true" />
          {step.tap && (
            <span
              className={`sgd-tap ${hole.top + hole.height + 40 > vh ? "is-above" : ""} ${
                hole.left + hole.width / 2 > vw - 70
                  ? "is-right"
                  : hole.left + hole.width / 2 < 70
                    ? "is-left"
                    : ""
              }`}
              aria-hidden="true"
            >
              <span className="sgd-tap__hand">👆</span>
              Tap here
            </span>
          )}
        </div>
      ) : (
        <div className="sgd-dim" />
      )}

      {/* blocks clicks on the page while the guide is open */}
      <div className="sgd-blocker" onClick={(event) => event.stopPropagation()} />

      <div
        ref={cardRef}
        className={`sgd-card ${ready ? "is-ready" : ""}`}
        style={cardStyle}
        key={index}
      >
        <div className="sgd-card__top">
          <span className="sgd-step">
            {steps.length > 1 ? `Step ${index + 1} of ${steps.length}` : "Guide"}
          </span>
          <button type="button" className="sgd-x" onClick={finish} aria-label="Close guide">
            ×
          </button>
        </div>

        <h3 id="sgd-title">{step.title}</h3>
        <p>{step.text}</p>

        {steps.length > 1 && (
          <div className="sgd-dots" aria-hidden="true">
            {steps.map((_, dot) => (
              <i key={dot} className={dot === index ? "is-on" : dot < index ? "is-done" : ""} />
            ))}
          </div>
        )}

        <div className="sgd-actions">
          {index > 0 ? (
            <button type="button" className="sgd-btn sgd-btn--ghost" onClick={() => setIndex(index - 1)}>
              Back
            </button>
          ) : (
            <button type="button" className="sgd-btn sgd-btn--ghost" onClick={finish}>
              Skip
            </button>
          )}
          <button
            type="button"
            className="sgd-btn sgd-btn--primary"
            onClick={() => (isLast ? finish() : setIndex(index + 1))}
            autoFocus
          >
            {isLast ? "Done" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
