import { useEffect, useRef } from "react";
import "./OwlOfficer.css";

/*
 * Owl officer sitting behind the Live tracking card (the card is his desk).
 *
 * Artwork and motions come from owl-animated.html:
 *  - gentle bob, random blinking, glancing around,
 *  - "talking" (beak opens in syllables, head tilts) every few seconds,
 *  - waving + cap tip when tapped (and once when he appears).
 *
 * Two layers: the owl behind the card, and his resting wing drawn on top
 * of the card's top edge. All ids are prefixed "ofc-" so they can't clash
 * with other SVGs on the page.
 */

// viewBox crops the original 1107.9 × 763.1 scene to the owl.
// The desk's top edge (y = 440.93) is where the card's top edge sits.
const VIEW_BOX = "440 105 490 355";

const OWL_BACK = `<defs>
<clipPath id="ofc-clipR"><ellipse transform="translate(588.44 130.59)" cx="198" cy="137" rx="38" ry="41.5"/></clipPath>
<clipPath id="ofc-clipL"><ellipse cx="16.125" cy="30.86" rx="16.125" ry="30.86" transform="translate(667.44 223.59) matrix(0.971635 0.236486 -0.188356 0.982101 6.86133 -3.57117)"/></clipPath>
</defs>
<g id="ofc-owl" class="ofc-move">
  <g id="ofc-wing-wave" style="transform-origin:646.8px 325.8px">
    <g transform="translate(510.79 216.13)"><path d="M107.819 106.688C82.1155 112.39 23.1447 -9.21734 0.000240592 0.559803C3.51803 18.119 38.4523 172.444 82.2008 162.739C107.905 157.037 205.29 141.478 201.772 123.919C198.254 106.36 133.523 100.986 107.819 106.688Z" fill="#61ADDD"/></g>  
    <g transform="translate(510.77 158.17)"><path d="M121.324 109.111C92.3882 111.288 94.1704 12.3744 7.13874 0.0459279C-24.5454 -3.74427 56.6234 228.313 105.872 224.608C134.808 222.431 225.629 182.42 223.157 149.554C220.685 116.688 150.259 106.934 121.324 109.111Z" fill="#36779F"/></g>  
    <g transform="translate(578.04 200.80)"><path d="M25.8999 101.692C17.9844 89.0653 -11.1687 12.9085 4.60886 1.6845C20.3864 -9.53949 43.0861 38.1827 62.8587 60.3218C72.6898 71.3297 87.9927 114.602 72.2151 125.826C56.4375 137.05 33.8155 114.319 25.8999 101.692Z" fill="#284E66"/></g>  
  </g>
  <g id="ofc-body">
    <g transform="translate(622.46 156.17)"><path d="M280.046 213.551C293.758 267.683 221.968 394.495 158.108 393.051C47.5459 390.551 13.7058 301.572 2.5497 238.551C-17.4541 125.551 86.0456 1.43246 110.939 0.0513065C135.832 -1.32984 232.046 24.0514 280.046 213.551Z" fill="url(#ofc-g_Ellipse_3)"/> <defs> <radialGradient id="ofc-g_Ellipse_3" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(82 218.685) rotate(47.7174) scale(216.264 155.018)"> <stop stop-color="#4DB4E8"/> </radialGradient> </defs></g>  
  </g>
  
  <g id="ofc-head" style="transform-origin:788.4px 240.6px">
<g transform="translate(698.44 148.59)"><path d="M214.5 13.3665C218 59.8665 173.563 188.366 128 188.366C82.4365 188.366 0 173.93 0 128.366C0 82.8029 26 34.3668 130.5 25.8666C166 17.8667 214.5 -19.6333 214.5 13.3665Z" fill="url(#ofc-paint0_linear_35_204)"/>
<defs>
<linearGradient id="ofc-paint0_linear_35_204" x1="156.954" y1="44.5" x2="107.454" y2="160" gradientUnits="userSpaceOnUse">
<stop offset="0.134615" stop-color="#42A76F"/>
</linearGradient>
</defs></g>
<g transform="translate(706.44 163.59)"><path d="M191.293 11.4559C182.449 -6.59802 97.3962 -2.01582 44.1963 16.1483C26.4522 22.2067 -15.0713 68.9495 5.66942 117.628C-1.59959 88.7494 2.01102 49.032 47.7928 29.456C110.09 2.81848 155.793 29.4569 164.793 32.4566C175.436 33.0828 188.106 32.2292 193.334 38.546C195.563 32.0694 195.401 23.214 191.293 11.4559Z" fill="url(#ofc-paint0_linear_35_228)"/>
<defs>
<linearGradient id="ofc-paint0_linear_35_228" x1="128.103" y1="97.229" x2="48.6011" y2="8.85602" gradientUnits="userSpaceOnUse">
<stop offset="0.5625" stop-color="#42A76F"/>
<stop offset="1" stop-color="#80CDA2"/>
</linearGradient>
</defs></g>
<g transform="translate(648.44 148.59)"><path d="M12.8554 0.490253C22.8556 -5.00871 52.3553 36.7432 53.8554 75.9902C53.8554 95.4503 54.1164 122.339 48.3857 143.354C49.7402 136.935 50.574 129.554 50.7656 121.124C51.7619 77.2848 31.415 46.3513 13.4629 40.1914C12.2678 38.8769 10.9042 37.6396 9.35544 36.4903C1.00403 30.2928 -8.14445 17.4902 12.8554 0.490253Z" fill="url(#ofc-paint0_linear_35_225)"/>
<defs>
<linearGradient id="ofc-paint0_linear_35_225" x1="37.9999" y1="9.94811" x2="30.38" y2="143.55" gradientUnits="userSpaceOnUse">
<stop offset="0.110577" stop-color="#42A76F"/>
<stop offset="1" stop-color="#74C598"/>
</linearGradient>
</defs></g>
<g transform="translate(636.44 186.59)"><path d="M62.9645 80.9808C61.7039 135.99 27.7264 144.966 9.53661 135.968C-17.0171 122.833 19.6177 62.985 26.1702 48.4885C36.2508 24.9941 25.1621 7.49822 25.1621 2.19247e-07C43.3073 5.99857 63.9726 36.9912 62.9645 80.9808Z" fill="url(#ofc-paint0_radial_35_212)"/>
<defs>
<radialGradient id="ofc-paint0_radial_35_212" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(31.0086 82) rotate(114.427) scale(143.879 65.2115)">
<stop offset="0.408654" stop-color="#86D0B9"/>
</radialGradient>
</defs></g>
<g transform="translate(703.44 184.59)"><ellipse cx="83" cy="83.5" rx="83" ry="83.5" fill="url(#ofc-paint0_radial_35_206)"/>
<defs>
<radialGradient id="ofc-paint0_radial_35_206" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(64 89) rotate(65.4752) scale(263.8 262.22)">
<stop offset="0.249816" stop-color="#86D0B9"/>
</radialGradient>
</defs></g>
<g id="ofc-eyeL" class="ofc-eye" style="transform-origin:684.4px 254.6px"><g id="ofc-irisL"><g transform="translate(655.44 208.59)"><ellipse cx="21.1472" cy="43.8914" rx="21.1472" ry="43.8914" transform="matrix(0.952541 0.30441 -0.244199 0.969725 13.3965 -5.94739)" fill="url(#ofc-paint0_linear_35_214)"/>
<defs>
<linearGradient id="ofc-paint0_linear_35_214" x1="21.1472" y1="-1.03176e-06" x2="-131.247" y2="198.877" gradientUnits="userSpaceOnUse">
<stop stop-color="#8AD9A4"/>
<stop offset="1" stop-color="#497357"/>
</linearGradient>
</defs></g></g>
<g transform="translate(667.44 223.59)"><ellipse cx="16.125" cy="30.8613" rx="16.125" ry="30.8613" transform="matrix(0.971635 0.236486 -0.188356 0.982101 6.86133 -3.57117)" fill="white"/></g>
<g clip-path="url(#ofc-clipL)"><g id="ofc-pupilL"><g transform="translate(683.44 238.59)"><ellipse cx="9.37485" cy="15.354" rx="9.37485" ry="15.354" transform="matrix(0.983697 0.179832 -0.108938 0.994049 1.82422 -1.59167)" fill="#222222"/></g><g transform="translate(689.44 241.59)"><circle cx="1.5" cy="1.5" r="1.5" fill="white"/></g></g></g></g>
<path id="ofc-lidL" transform="translate(588.44 130.59)" d="M83 124 Q97 130 112 124" fill="none" stroke="#2E602E" stroke-width="2.5" stroke-linecap="round" opacity="0"/>
<g id="ofc-eyeR" class="ofc-eye" style="transform-origin:786.4px 267.6px"><g id="ofc-irisR"><g transform="translate(729.94 210.59)"><ellipse cx="56.5" cy="57" rx="56.5" ry="57" fill="url(#ofc-paint0_radial_35_207)"/>
<defs>
<radialGradient id="ofc-paint0_radial_35_207" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(19 41.5) rotate(2.2849) scale(200.66 198.899)">
<stop offset="0.346154" stop-color="#8AD9A4"/>
<stop offset="1" stop-color="#497357"/>
</radialGradient>
</defs></g></g>
<g transform="translate(748.44 226.09)"><ellipse cx="38" cy="41.5" rx="38" ry="41.5" fill="#FFFDFD"/></g>
<g clip-path="url(#ofc-clipR)"><g id="ofc-pupilR"><g transform="translate(765.44 236.59)"><ellipse cx="22" cy="27.5" rx="22" ry="27.5" fill="#222222"/></g><g transform="translate(771.44 244.59)"><circle cx="3.5" cy="3.5" r="3.5" fill="white"/></g></g></g></g>
<path id="ofc-lidR" transform="translate(588.44 130.59)" d="M162 137 Q198 152 234 137" fill="none" stroke="#2E602E" stroke-width="3.5" stroke-linecap="round" opacity="0"/>
<g id="ofc-brows">
<defs>
<linearGradient id="ofc-brow-grad" x1="0" y1="0" x2="0" y2="1">
<stop stop-color="#2E602E"/>
<stop offset="1" stop-color="#243F24"/>
</linearGradient>
</defs>
<path id="ofc-browL" d="M638.6 203 Q655 187.5 676.2 183.3 L677 191.1 Q657 196.5 643.4 211.4 Z" fill="url(#ofc-brow-grad)"/>
</g>
<g id="ofc-cap" style="transform-origin:748.4px 160.6px">
<g transform="translate(677.44 135.59)"><path d="M10.2222 0.0568023C28.2916 0.0568123 90.2223 2.91033 128.222 0.0568021C152.222 -1.74544 143.222 39.9376 143.222 39.9376C143.222 39.9376 136.173 51.4468 110.722 52.9221C94.7222 53.8496 10.2223 65.9106 10.2222 50.1397C10.2221 30.5811 -12.7777 0.0567895 10.2222 0.0568023Z" fill="#00345E"/></g>
<g transform="translate(680.44 163.59)"><path d="M0 2C0 2 30 5.5 49 5.5C84.564 5.5 140 0 140 0L139.5 5.5C139.5 5.5 84.56 11.0318 49 10.5C30.6308 10.2253 2 8.5 2 8.5L0 2Z" fill="#FEF05A"/></g>
<g transform="translate(656.44 178.59)"><path d="M0.502869 10.2752C-9.76122 -8.72476 140.503 4.44414 140.503 4.44414L98.5029 15.4441C98.5029 15.4441 80.0029 23.6131 48.5029 12.4441C45.6937 11.4481 1.91951 12.8976 0.502869 10.2752Z" fill="#145080"/></g>
</g>
<path id="ofc-browR" d="M775.8 169.6 Q845 177 901.8 203 L897.6 220.9 Q842 188 775.8 177.4 Z" fill="url(#ofc-brow-grad)"/>
<g id="ofc-beak">
<path id="ofc-mouth" d="M664.4 304.6 L701.4 300.6 L711.4 287.6 L709.4 302.6 Q692.4 316.6 668.4 310.6 Z" fill="#5A2A1A" opacity="0"/>
<g id="ofc-beak-lower" style="transform-origin:710.4px 290.6px">
<g transform="translate(676.44 281.59)"><path d="M0.00038915 20.2465C0.00038915 20.2465 8.49679 23.3497 12.6594 24.2775C17.0428 25.2545 34.7949 21.5308 34.7949 12C34.7949 6.00002 36.2948 2.18081e-05 33.7948 1.49114e-05C18.7645 -2.61917e-05 16.9429 16.2213 16.9429 16.2213L0.00038915 20.2465Z" fill="url(#ofc-paint0_linear_35_231)"/>
<defs>
<linearGradient id="ofc-paint0_linear_35_231" x1="16.8799" y1="24.6065" x2="17.7948" y2="-0.499977" gradientUnits="userSpaceOnUse">
<stop stop-color="#BD9F28"/>
</linearGradient>
</defs></g>
</g>
<g id="ofc-beak-upper" style="transform-origin:710.4px 286.6px">
<g transform="translate(661.44 273.59)"><path d="M0.000338672 31.8548C0.000338672 31.8548 5.47172 23.6429 9.50266 18.7894C13.4967 13.9803 20.4931 7.15066 20.4931 7.15066C20.4931 7.15066 40.1604 -8.56262 49.0231 6.59705C57.9038 21.7875 37.0467 31.5889 37.0467 31.5889L0.000338672 31.8548Z" fill="url(#ofc-paint0_radial_35_232)"/>
<defs>
<radialGradient id="ofc-paint0_radial_35_232" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(29.2889 9.32149) rotate(67.4259) scale(48.1923 88.9418)">
<stop stop-color="#FFE204"/>
</radialGradient>
</defs></g>
</g>
</g>
  </g>
  <g id="ofc-baton" style="transform-origin:836.8px 485.8px">
    <g transform="translate(623.85 341.18)"><path d="M1.93896 0L250.536 159.414C250.536 159.414 252.694 168.971 253.57 172.849C254.445 176.727 255.021 179.274 255.021 179.274L0.0502934 18.8994C0.0502934 18.8994 0.489844 12.6864 0.0502933 8.89935C-0.365902 5.3135 1.93896 0 1.93896 0Z" fill="#87715D"/></g>  
  </g>
</g>`;

const OWL_FRONT = `<g id="ofc-wing-rest" class="ofc-move">
    <g transform="translate(664.51 386.45)"><path d="M115.587 0.0533374C102.264 0.816443 -2.80957 26.3878 0.0576133 50.6675C2.9248 74.9473 138.485 74.4663 161.161 73.1675C174.484 72.4044 164.028 55.1372 161.161 30.8574C158.293 6.57769 128.91 -0.709769 115.587 0.0533374Z" fill="#284E66"/></g>  
    <g transform="translate(599.86 337.36)"><path d="M281.282 117.272C268.607 143.375 42.7883 124.227 4.7819 105.772C-33.2245 87.3174 167.141 90.3408 188.714 45.9132C201.388 19.8104 259.577 -13.0768 297.583 5.37792C335.59 23.8326 293.956 91.1692 281.282 117.272Z" fill="#36779F"/></g>  
    <g transform="translate(645.23 370.99)"><path d="M241.624 81.198C231.391 108.692 2.06346 112.49 2.0968 86.3655C-21.5028 77.0065 161.544 79.5595 178.96 32.7638C189.192 5.26951 218.024 -6.14019 241.624 3.21882C265.223 12.5778 251.856 53.7037 241.624 81.198Z" fill="#61ADDD"/></g>  
</g>`;

const rand = (min: number, max: number) => min + Math.random() * (max - min);

export default function OwlOfficer() {
  const backRef = useRef<SVGSVGElement>(null);
  const waveRef = useRef<() => void>(() => {});

  useEffect(() => {
    const root = backRef.current;
    if (!root) return undefined;

    const $ = (id: string) => root.querySelector<SVGGElement>(`#ofc-${id}`);
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const timers = new Set<number>();
    let alive = true;

    const later = (fn: () => void, ms: number) => {
      const id = window.setTimeout(() => {
        timers.delete(id);
        if (alive) fn();
      }, ms);
      timers.add(id);
    };

    /* ---- blinking: eyes squash + eyelid line ---- */
    const eyes: [Element | null, Element | null][] = [
      [$("eyeL"), $("lidL")],
      [$("eyeR"), $("lidR")],
    ];

    const blink = () => {
      eyes.forEach(([eye, lid]) => {
        eye?.animate(
          [{ transform: "scaleY(1)" }, { transform: "scaleY(0.06)", offset: 0.45 }, { transform: "scaleY(1)" }],
          { duration: 170, easing: "ease-in-out" }
        );
        lid?.animate(
          [{ opacity: 0 }, { opacity: 0, offset: 0.3 }, { opacity: 1, offset: 0.45 }, { opacity: 0, offset: 0.7 }, { opacity: 0 }],
          { duration: 170 }
        );
      });
    };

    const blinkLoop = () =>
      later(() => {
        if (!document.hidden) {
          blink();
          if (Math.random() < 0.2) later(blink, 260);
        }
        blinkLoop();
      }, 2500 + Math.random() * 3500);

    /* ---- looking around ---- */
    const gaze = [
      { el: $("pupilR"), rx: 14, ry: 12, k: 1 },
      { el: $("irisR"), rx: 14, ry: 12, k: 0.35 },
      { el: $("pupilL"), rx: 5, ry: 13, k: 1 },
      { el: $("irisL"), rx: 5, ry: 13, k: 0.35 },
    ];
    let current = { x: 0, y: 0 };
    let gazeAnims: Animation[] = [];

    const lookAt = (x: number, y: number, duration: number) => {
      const previous = gazeAnims;
      gazeAnims = gaze
        .filter((g) => g.el)
        .map((g) =>
          g.el!.animate(
            [
              { transform: `translate(${current.x * g.rx * g.k}px, ${current.y * g.ry * g.k}px)` },
              { transform: `translate(${x * g.rx * g.k}px, ${y * g.ry * g.k}px)` },
            ],
            { duration: reduce ? 0 : duration, easing: "cubic-bezier(.3,0,.2,1)", fill: "forwards" }
          )
        );
      previous.forEach((animation) => animation.cancel());
      current = { x, y };
    };

    const glance = () => {
      if (document.hidden) return later(glance, 2000);
      if (current.x || current.y) {
        lookAt(0, 0, 260);
        return later(glance, rand(1800, 4500));
      }
      const directions = [[1, 0], [-1, 0], [0, -1], [0, 0.8], [0.8, -0.7], [-0.8, -0.7], [0.8, 0.6], [-0.8, 0.6]];
      const [dx, dy] = directions[Math.floor(Math.random() * directions.length)];
      const reach = rand(0.7, 1);
      lookAt(dx * reach, dy * reach, rand(180, 280));
      if (Math.random() < 0.25) {
        later(() => lookAt(-dx * reach, dy * reach, 320), rand(500, 800));
        return later(glance, rand(1400, 2000));
      }
      later(glance, rand(700, 2200));
    };

    /* ---- talking: bursts of syllables ---- */
    let talking = false;
    let waving = false;

    const talk = () => {
      if (talking || waving || document.hidden) return;
      talking = true;

      const syllables = Math.round(rand(4, 11));
      const lower: Keyframe[] = [];
      const upper: Keyframe[] = [];
      const mouth: Keyframe[] = [];
      const parts: number[] = [];
      let total = 0;

      for (let i = 0; i < syllables; i += 1) {
        const sd = rand(110, 200);
        parts.push(sd);
        total += sd;
        if (Math.random() < 0.2 && i < syllables - 1) {
          const pause = rand(120, 260);
          parts.push(-pause);
          total += pause;
        }
      }

      const key = (offset: number, open: number) => {
        lower.push({ offset, easing: "ease-in-out", transform: `translate(${(-3 * open).toFixed(2)}px, ${(7 * open).toFixed(2)}px) rotate(${(-12 * open).toFixed(1)}deg)` });
        upper.push({ offset, easing: "ease-in-out", transform: `rotate(${(6 * open).toFixed(1)}deg)` });
        mouth.push({ offset, easing: "ease-in-out", opacity: Math.min(1, open * 2) });
      };

      let t = 0;
      key(0, 0);
      parts.forEach((part) => {
        const pause = part < 0;
        const duration = Math.abs(part);
        const amount = pause ? 0 : rand(0.45, 1);
        key((t + duration * 0.45) / total, amount);
        t += duration;
        key(Math.min(t / total, 1), 0);
      });
      lower[lower.length - 1].offset = 1;
      upper[upper.length - 1].offset = 1;
      mouth[mouth.length - 1].offset = 1;

      const options = { duration: total };
      $("beak-lower")?.animate(lower, options);
      $("beak-upper")?.animate(upper, options);
      $("mouth")?.animate(mouth, options);
      if (!reduce) {
        $("head")?.animate(
          [{ transform: "rotate(0)" }, { transform: "rotate(2deg)", offset: 0.25 }, { transform: "rotate(-1.5deg)", offset: 0.6 }, { transform: "rotate(1deg)", offset: 0.85 }, { transform: "rotate(0)" }],
          { duration: total, easing: "ease-in-out" }
        );
      }
      later(() => {
        talking = false;
      }, total);
    };

    const talkLoop = () =>
      later(() => {
        talk();
        talkLoop();
      }, rand(2500, 6500));

    /* ---- wave (tap, Enter / Space, and once on arrival) ---- */
    const wave = () => {
      if (waving) return;
      waving = true;
      const angle = reduce ? 6 : 22;
      const animation = $("wing-wave")?.animate(
        [0, -angle, angle * 0.3, -angle, angle * 0.3, -angle * 0.8, 0].map((r) => ({ transform: `rotate(${r}deg)` })),
        { duration: reduce ? 500 : 1100, easing: "ease-in-out" }
      );
      $("head")?.animate(
        [{ transform: "rotate(0)" }, { transform: "rotate(-5deg)", offset: 0.3 }, { transform: "rotate(-5deg)", offset: 0.7 }, { transform: "rotate(0)" }],
        { duration: 1100, easing: "ease-in-out" }
      );
      $("cap")?.animate(
        [{ transform: "translateY(0)" }, { transform: "translateY(-10px) rotate(-3deg)", offset: 0.25 }, { transform: "translateY(0)", offset: 0.5 }],
        { duration: 1100, easing: "ease-out" }
      );
      if (animation) {
        animation.onfinish = animation.oncancel = () => {
          waving = false;
        };
      } else {
        waving = false;
      }
    };
    waveRef.current = wave;

    blinkLoop();
    later(glance, 1500);
    talkLoop();
    later(wave, 600);
    later(talk, 2200);

    return () => {
      alive = false;
      timers.forEach((id) => window.clearTimeout(id));
      gazeAnims.forEach((animation) => animation.cancel());
    };
  }, []);

  const onWave = () => waveRef.current();

  return (
    <div className="ofc">
      {/* the owl, behind the card */}
      <svg
        ref={backRef}
        className="ofc-back"
        viewBox={VIEW_BOX}
        xmlns="http://www.w3.org/2000/svg"
        role="button"
        tabIndex={0}
        aria-label="CampuServe owl. Tap to make him wave."
        onClick={onWave}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onWave();
          }
        }}
        dangerouslySetInnerHTML={{ __html: OWL_BACK }}
      />

      {/* his resting wing, on top of the card */}
      <svg
        className="ofc-front"
        viewBox={VIEW_BOX}
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        onClick={onWave}
        dangerouslySetInnerHTML={{ __html: OWL_FRONT }}
      />
    </div>
  );
}
