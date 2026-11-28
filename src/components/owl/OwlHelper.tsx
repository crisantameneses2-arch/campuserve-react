import { useEffect, useRef } from "react";
import "./OwlHelper.css";

/*
 * CampuServe owl officer for the help pages, in two poses:
 *
 *  pose="thinking"  (Help Center & FAQs, from owl-thinking-animated.html)
 *    - floating question marks, eyes gazing up toward them,
 *    - "hmm": taps his chin with the raised wing and tilts his head
 *      (on arrival, now and then, when tapped, and when `nudge` changes:
 *      he first glances down at the answer that was opened).
 *
 *  pose="headset"   (Contact Support, from owl-headset-animated.html)
 *    - glances around and "talks" every few seconds,
 *    - presses his earpiece (on arrival, when tapped, and when `nudge`
 *      changes: then he also answers, i.e. talks).
 *
 * Both: gentle bob and random blinking.
 * Ids are prefixed per pose ("oth-" / "ohs-") so they never clash with
 * the dashboard owl (all drawings share the same Figma gradient ids).
 */

export type OwlPose = "thinking" | "headset";

type PoseArt = {
  prefix: string;
  viewBox: string;
  label: string;
  svg: string;
};

const POSES: Record<OwlPose, PoseArt> = {
  /* cropped to owl + question marks; feet on the bottom edge (y≈518) */
  thinking: {
    prefix: "oth",
    viewBox: "-32 -150 384 670",
    label: "CampuServe owl, thinking. Tap to make him think.",
    svg: `
<defs>
<clipPath id="oth-clipR"><ellipse cx="198" cy="137" rx="38" ry="41.5"/></clipPath>
<clipPath id="oth-clipL"><ellipse cx="16.125" cy="30.86" rx="16.125" ry="30.86" transform="translate(79 93) matrix(0.971635 0.236486 -0.188356 0.982101 6.86133 -3.57117)"/></clipPath>
</defs>
<g id="oth-legs">
<g transform="translate(148 405)"><path d="M0 0L17 -2.33313e-08L17 100L1.37243e-07 100L0 0Z" fill="url(#oth-paint0_linear_35_194)"/>
<defs>
<linearGradient id="oth-paint0_linear_35_194" x1="8.5" y1="-1.16656e-08" x2="8.5" y2="100" gradientUnits="userSpaceOnUse">
<stop offset="1" stop-color="#EFE946"/>
</linearGradient>
</defs></g>
<g transform="translate(197 395)"><path d="M0 0L17 -2.33313e-08L17 100L1.37243e-07 100L0 0Z" fill="url(#oth-paint0_linear_35_195)"/>
<defs>
<linearGradient id="oth-paint0_linear_35_195" x1="8.5" y1="-1.16656e-08" x2="8.5" y2="100" gradientUnits="userSpaceOnUse">
<stop offset="1" stop-color="#FAF446"/>
</linearGradient>
</defs></g>
<g transform="translate(88 482)"><path d="M3.5 13.9132C19 -12.5868 90.5 6.91325 90.5 6.91325L89 23.4133L3.62502e-08 26.4132C3.62502e-08 26.4132 0.940591 18.289 3.5 13.9132Z" fill="url(#oth-paint0_linear_35_196)"/>
<defs>
<linearGradient id="oth-paint0_linear_35_196" x1="21" y1="13" x2="24" y2="68" gradientUnits="userSpaceOnUse">
<stop stop-color="#F2D94D"/>
</linearGradient>
</defs></g>
<g transform="translate(140 492)"><path d="M3.5 13.9132C19 -12.5868 90.5 6.91325 90.5 6.91325L89 23.4133L3.62502e-08 26.4132C3.62502e-08 26.4132 0.940591 18.289 3.5 13.9132Z" fill="url(#oth-paint0_linear_35_197)"/>
<defs>
<linearGradient id="oth-paint0_linear_35_197" x1="28.5" y1="-9.48865e-07" x2="64.5" y2="71.5" gradientUnits="userSpaceOnUse">
<stop stop-color="#FDE353"/>
</linearGradient>
</defs></g>
</g>
<g id="oth-upper" class="oth-move">
<g id="oth-bag">
<g transform="translate(202 350)"><path d="M0 0H128L141 59L0 76.5V0Z" fill="#87715D"/></g>
</g>
<g id="oth-body">
<g transform="translate(42 16)"><path d="M280.046 213.551C293.758 267.683 221.968 394.495 158.108 393.051C47.5459 390.551 13.7058 301.572 2.5497 238.551C-17.4541 125.551 86.0456 1.43246 110.939 0.0513065C135.832 -1.32984 232.046 24.0514 280.046 213.551Z" fill="url(#oth-paint0_radial_35_202)"/>
<defs>
<radialGradient id="oth-paint0_radial_35_202" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(82 218.685) rotate(47.7174) scale(216.264 155.018)">
<stop stop-color="#4DB4E8"/>
</radialGradient>
</defs></g>
</g>
<g id="oth-head" style="transform-origin:200px 110px">
<g transform="translate(110 18)"><path d="M214.5 13.3665C218 59.8665 173.563 188.366 128 188.366C82.4365 188.366 0 173.93 0 128.366C0 82.8029 26 34.3668 130.5 25.8666C166 17.8667 214.5 -19.6333 214.5 13.3665Z" fill="url(#oth-paint0_linear_35_204)"/>
<defs>
<linearGradient id="oth-paint0_linear_35_204" x1="156.954" y1="44.5" x2="107.454" y2="160" gradientUnits="userSpaceOnUse">
<stop offset="0.134615" stop-color="#42A76F"/>
</linearGradient>
</defs></g>
<g transform="translate(118 33)"><path d="M191.293 11.4559C182.449 -6.59802 97.3962 -2.01582 44.1963 16.1483C26.4522 22.2067 -15.0713 68.9495 5.66942 117.628C-1.59959 88.7494 2.01102 49.032 47.7928 29.456C110.09 2.81848 155.793 29.4569 164.793 32.4566C175.436 33.0828 188.106 32.2292 193.334 38.546C195.563 32.0694 195.401 23.214 191.293 11.4559Z" fill="url(#oth-paint0_linear_35_228)"/>
<defs>
<linearGradient id="oth-paint0_linear_35_228" x1="128.103" y1="97.229" x2="48.6011" y2="8.85602" gradientUnits="userSpaceOnUse">
<stop offset="0.5625" stop-color="#42A76F"/>
<stop offset="1" stop-color="#80CDA2"/>
</linearGradient>
</defs></g>
<g transform="translate(60 18)"><path d="M12.8554 0.490253C22.8556 -5.00871 52.3553 36.7432 53.8554 75.9902C53.8554 95.4503 54.1164 122.339 48.3857 143.354C49.7402 136.935 50.574 129.554 50.7656 121.124C51.7619 77.2848 31.415 46.3513 13.4629 40.1914C12.2678 38.8769 10.9042 37.6396 9.35544 36.4903C1.00403 30.2928 -8.14445 17.4902 12.8554 0.490253Z" fill="url(#oth-paint0_linear_35_225)"/>
<defs>
<linearGradient id="oth-paint0_linear_35_225" x1="37.9999" y1="9.94811" x2="30.38" y2="143.55" gradientUnits="userSpaceOnUse">
<stop offset="0.110577" stop-color="#42A76F"/>
<stop offset="1" stop-color="#74C598"/>
</linearGradient>
</defs></g>
<g transform="translate(48 56)"><path d="M62.9645 80.9808C61.7039 135.99 27.7264 144.966 9.53661 135.968C-17.0171 122.833 19.6177 62.985 26.1702 48.4885C36.2508 24.9941 25.1621 7.49822 25.1621 2.19247e-07C43.3073 5.99857 63.9726 36.9912 62.9645 80.9808Z" fill="url(#oth-paint0_radial_35_212)"/>
<defs>
<radialGradient id="oth-paint0_radial_35_212" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(31.0086 82) rotate(114.427) scale(143.879 65.2115)">
<stop offset="0.408654" stop-color="#86D0B9"/>
</radialGradient>
</defs></g>
<g transform="translate(115 54)"><ellipse cx="83" cy="83.5" rx="83" ry="83.5" fill="url(#oth-paint0_radial_35_206)"/>
<defs>
<radialGradient id="oth-paint0_radial_35_206" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(64 89) rotate(65.4752) scale(263.8 262.22)">
<stop offset="0.249816" stop-color="#86D0B9"/>
</radialGradient>
</defs></g>
<g id="oth-eyeL" class="oth-eye" style="transform-origin:96px 124px"><g id="oth-irisL"><g transform="translate(67 78)"><ellipse cx="21.1472" cy="43.8914" rx="21.1472" ry="43.8914" transform="matrix(0.952541 0.30441 -0.244199 0.969725 13.3965 -5.94739)" fill="url(#oth-paint0_linear_35_214)"/>
<defs>
<linearGradient id="oth-paint0_linear_35_214" x1="21.1472" y1="-1.03176e-06" x2="-131.247" y2="198.877" gradientUnits="userSpaceOnUse">
<stop stop-color="#8AD9A4"/>
<stop offset="1" stop-color="#497357"/>
</linearGradient>
</defs></g></g>
<g transform="translate(79 93)"><ellipse cx="16.125" cy="30.8613" rx="16.125" ry="30.8613" transform="matrix(0.971635 0.236486 -0.188356 0.982101 6.86133 -3.57117)" fill="white"/></g>
<g clip-path="url(#oth-clipL)"><g id="oth-pupilL"><g transform="translate(95 108)"><ellipse cx="9.37485" cy="15.354" rx="9.37485" ry="15.354" transform="matrix(0.983697 0.179832 -0.108938 0.994049 1.82422 -1.59167)" fill="#222222"/></g><g transform="translate(101 111)"><circle cx="1.5" cy="1.5" r="1.5" fill="white"/></g></g></g></g>
<path id="oth-lidL" d="M83 124 Q97 130 112 124" fill="none" stroke="#2E602E" stroke-width="2.5" stroke-linecap="round" opacity="0"/>
<g id="oth-eyeR" class="oth-eye" style="transform-origin:198px 137px"><g id="oth-irisR"><g transform="translate(141.5 80)"><ellipse cx="56.5" cy="57" rx="56.5" ry="57" fill="url(#oth-paint0_radial_35_207)"/>
<defs>
<radialGradient id="oth-paint0_radial_35_207" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(19 41.5) rotate(2.2849) scale(200.66 198.899)">
<stop offset="0.346154" stop-color="#8AD9A4"/>
<stop offset="1" stop-color="#497357"/>
</radialGradient>
</defs></g></g>
<g transform="translate(160 95.5)"><ellipse cx="38" cy="41.5" rx="38" ry="41.5" fill="#FFFDFD"/></g>
<g clip-path="url(#oth-clipR)"><g id="oth-pupilR"><g transform="translate(177 106)"><ellipse cx="22" cy="27.5" rx="22" ry="27.5" fill="#222222"/></g><g transform="translate(183 114)"><circle cx="3.5" cy="3.5" r="3.5" fill="white"/></g></g></g></g>
<path id="oth-lidR" d="M162 137 Q198 152 234 137" fill="none" stroke="#2E602E" stroke-width="3.5" stroke-linecap="round" opacity="0"/>
<g id="oth-brows">
<g transform="translate(66.65 93.35) matrix(0.99539 -0.21992 0.35659 0.93289 -5.107 5.978)"><path d="M2.00361 3.82477C2.00361 3.82477 13.181 0.61026 21.9486 0.0301951C30.7162 -0.54987 45.3663 7.43131 45.3663 7.43131L44.9019 14.1677C44.9019 14.1677 30.5684 10.7297 21.8007 11.3098C13.0331 11.8898 3.71208e-05 17.1383 3.71208e-05 17.1383L2.00361 3.82477Z" fill="url(#oth-paint0_linear_35_224)"/><defs>
<linearGradient id="oth-paint0_linear_35_224" x1="21.8727" y1="0.0352146" x2="22.904" y2="15.623" gradientUnits="userSpaceOnUse">
<stop stop-color="#2E602E"/>
<stop offset="1" stop-color="#243F24"/>
</linearGradient></defs></g>
<g transform="translate(162.00 46.35) matrix(0.99480 0.00032 0.00126 0.99287 0.540 0.052)"><path d="M0.000175779 11.0789C0.000175779 11.0789 48.3359 -3.3283 74.587 0.716101C100.838 4.7605 130.443 11.5603 130.443 11.5603L135.723 31.4286C135.723 31.4286 95.6638 19.27 69.4127 15.2256C43.1617 11.1812 0.413198 18.8791 0.413198 18.8791L0.000175779 11.0789Z" fill="url(#oth-paint0_linear_35_236)"/><defs>
<linearGradient id="oth-paint0_linear_35_236" x1="71.5604" y1="-0.242497" x2="64.413" y2="37.2466" gradientUnits="userSpaceOnUse">
<stop stop-color="#2E602E"/>
<stop offset="1" stop-color="#243F24"/>
</linearGradient></defs></g>
</g>
<g id="oth-cap" style="transform-origin:160px 30px">
<g transform="translate(89 5)"><path d="M10.2222 0.0568023C28.2916 0.0568123 90.2223 2.91033 128.222 0.0568021C152.222 -1.74544 143.222 39.9376 143.222 39.9376C143.222 39.9376 136.173 51.4468 110.722 52.9221C94.7222 53.8496 10.2223 65.9106 10.2222 50.1397C10.2221 30.5811 -12.7777 0.0567895 10.2222 0.0568023Z" fill="#00345E"/></g>
<g transform="translate(92 33)"><path d="M0 2C0 2 30 5.5 49 5.5C84.564 5.5 140 0 140 0L139.5 5.5C139.5 5.5 84.56 11.0318 49 10.5C30.6308 10.2253 2 8.5 2 8.5L0 2Z" fill="#FEF05A"/></g>
<g transform="translate(68 48)"><path d="M0.502869 10.2752C-9.76122 -8.72476 140.503 4.44414 140.503 4.44414L98.5029 15.4441C98.5029 15.4441 80.0029 23.6131 48.5029 12.4441C45.6937 11.4481 1.91951 12.8976 0.502869 10.2752Z" fill="#145080"/></g>
</g>
<g id="oth-beak">
<path id="oth-mouth" d="M76 174 L113 170 L123 157 L121 172 Q104 186 80 180 Z" fill="#5A2A1A" opacity="0"/>
<g id="oth-beak-lower" style="transform-origin:122px 160px">
<g transform="translate(88 151)"><path d="M0.00038915 20.2465C0.00038915 20.2465 8.49679 23.3497 12.6594 24.2775C17.0428 25.2545 34.7949 21.5308 34.7949 12C34.7949 6.00002 36.2948 2.18081e-05 33.7948 1.49114e-05C18.7645 -2.61917e-05 16.9429 16.2213 16.9429 16.2213L0.00038915 20.2465Z" fill="url(#oth-paint0_linear_35_231)"/>
<defs>
<linearGradient id="oth-paint0_linear_35_231" x1="16.8799" y1="24.6065" x2="17.7948" y2="-0.499977" gradientUnits="userSpaceOnUse">
<stop stop-color="#BD9F28"/>
</linearGradient>
</defs></g>
</g>
<g id="oth-beak-upper" style="transform-origin:122px 156px">
<g transform="translate(73 143)"><path d="M0.000338672 31.8548C0.000338672 31.8548 5.47172 23.6429 9.50266 18.7894C13.4967 13.9803 20.4931 7.15066 20.4931 7.15066C20.4931 7.15066 40.1604 -8.56262 49.0231 6.59705C57.9038 21.7875 37.0467 31.5889 37.0467 31.5889L0.000338672 31.8548Z" fill="url(#oth-paint0_radial_35_232)"/>
<defs>
<radialGradient id="oth-paint0_radial_35_232" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(29.2889 9.32149) rotate(67.4259) scale(48.1923 88.9418)">
<stop stop-color="#FFE204"/>
</radialGradient>
</defs></g>
</g>
</g>
</g>
<g id="oth-strap">
<g transform="translate(38 208)"><path d="M1.63672 0L158.637 101C158.637 101 158.637 109.181 158.637 112.5C158.637 115.819 158.637 118 158.637 118L0.136723 16.5C0.136723 16.5 -0.170256 11.311 0.136722 8C0.42739 4.86494 1.63672 0 1.63672 0Z" fill="#7B6048"/></g>
</g>
<g id="oth-wing-raised" style="transform-origin:95px 340px">
    <path d="M72.0515 34.6636C74.4268 47.5901 71.7087 119.945 52.9016 124.549C34.0944 129.153 4.21789 53.2676 0.17505 31.2664C-2.20026 18.3399 20.109 5.1479 38.9162 0.543497C57.7234 -4.0609 69.6762 21.7371 72.0515 34.6636Z" transform="translate(24.49 251.67) matrix(1.46275 -0.54914 -0.35677 0.81933 11.898 27.347)" fill="#284E66"/>
    <path d="M0.0785939 113.243C-1.06544 142.238 10.1851 289.52 43.1182 290.82C76.0512 292.119 113.287 135.784 115.234 86.4346C116.378 57.4399 88.9431 1.31408 56.01 0.0146575C23.077 -1.28477 1.22263 84.248 0.0785939 113.243Z" transform="translate(5.96 186.04) matrix(-0.45604 1.65567 -0.41628 0.22961 145.248 -27.447)" fill="#36779F"/>
    <path d="M1.83484 83.2517C-1.16603 109.409 -2.63285 250.19 15.1128 252.597C32.8584 255.004 65.7274 95.8442 70.8349 51.3242C73.8358 25.167 66.5371 2.4778 48.7915 0.0709793C31.0459 -2.33584 4.83572 57.0946 1.83484 83.2517Z" transform="translate(-5.31 180.65) matrix(0.59650 -2.64378 -0.28170 -0.11922 63.569 192.514)" fill="#61ADDD"/>
</g>
<g id="oth-wingR" style="transform-origin:262px 232px">
    <g transform="translate(186.65 324.10)"><path d="M7.42326 27.9517C1.89257 40.0965 -8.86541 111.698 13.9549 120.471C36.7753 129.244 89.3401 61.5517 98.7535 40.8811C104.284 28.7363 78.7301 10.7461 55.9097 1.97353C33.0894 -6.79905 12.9539 15.807 7.42326 27.9517Z" fill="#284E66"/></g>
    <g transform="translate(191.35 215.04)"><path d="M141.654 124.277C137.412 152.982 94.3431 294.936 52.547 288.76C10.7508 282.583 -5.56557 120.778 1.65426 71.9208C5.8962 43.2152 51.5074 -5.6424 93.3036 0.533983C135.1 6.71036 145.896 95.5712 141.654 124.277Z" fill="#36779F"/></g>
    <g transform="translate(250.35 242.35)"><path d="M81.0881 92.3258C79.7447 118.668 53.992 257.12 31.1359 255.466C8.27993 253.812 -1.97423 90.2243 0.312198 45.3901C1.65558 19.0483 15.3107 -1.56071 38.1667 0.0929871C61.0227 1.74668 82.4314 65.984 81.0881 92.3258Z" fill="#61ADDD"/></g>
</g>
</g>
<g id="oth-question-marks" font-family="'Arial Rounded MT Bold','Nunito','Segoe UI',system-ui,sans-serif" font-weight="800" text-anchor="middle">
  <text class="oth-qm" x="255" y="-28" font-size="78" fill="#00345E">?</text>
  <text class="oth-qm" x="318" y="-72" font-size="54" fill="#42A76F">?</text>
  <text class="oth-qm" x="205" y="-84" font-size="40" fill="#4DB4E8">?</text>
</g>
`,
  },
  /* cropped to the owl; the raised wing reaches x≈457 */
  headset: {
    prefix: "ohs",
    viewBox: "8 -4 457 526",
    label: "CampuServe support owl with a headset. Tap to make him press his earpiece.",
    svg: `
<defs>
<clipPath id="ohs-clipR"><ellipse cx="198" cy="137" rx="38" ry="41.5"/></clipPath>
<clipPath id="ohs-clipL"><ellipse cx="16.125" cy="30.86" rx="16.125" ry="30.86" transform="translate(79 93) matrix(0.971635 0.236486 -0.188356 0.982101 6.86133 -3.57117)"/></clipPath>
</defs>
<g id="ohs-legs">
<g transform="translate(148 405)"><path d="M0 0L17 -2.33313e-08L17 100L1.37243e-07 100L0 0Z" fill="url(#ohs-paint0_linear_35_194)"/>
<defs>
<linearGradient id="ohs-paint0_linear_35_194" x1="8.5" y1="-1.16656e-08" x2="8.5" y2="100" gradientUnits="userSpaceOnUse">
<stop offset="1" stop-color="#EFE946"/>
</linearGradient>
</defs></g>
<g transform="translate(197 395)"><path d="M0 0L17 -2.33313e-08L17 100L1.37243e-07 100L0 0Z" fill="url(#ohs-paint0_linear_35_195)"/>
<defs>
<linearGradient id="ohs-paint0_linear_35_195" x1="8.5" y1="-1.16656e-08" x2="8.5" y2="100" gradientUnits="userSpaceOnUse">
<stop offset="1" stop-color="#FAF446"/>
</linearGradient>
</defs></g>
<g transform="translate(88 482)"><path d="M3.5 13.9132C19 -12.5868 90.5 6.91325 90.5 6.91325L89 23.4133L3.62502e-08 26.4132C3.62502e-08 26.4132 0.940591 18.289 3.5 13.9132Z" fill="url(#ohs-paint0_linear_35_196)"/>
<defs>
<linearGradient id="ohs-paint0_linear_35_196" x1="21" y1="13" x2="24" y2="68" gradientUnits="userSpaceOnUse">
<stop stop-color="#F2D94D"/>
</linearGradient>
</defs></g>
<g transform="translate(140 492)"><path d="M3.5 13.9132C19 -12.5868 90.5 6.91325 90.5 6.91325L89 23.4133L3.62502e-08 26.4132C3.62502e-08 26.4132 0.940591 18.289 3.5 13.9132Z" fill="url(#ohs-paint0_linear_35_197)"/>
<defs>
<linearGradient id="ohs-paint0_linear_35_197" x1="28.5" y1="-9.48865e-07" x2="64.5" y2="71.5" gradientUnits="userSpaceOnUse">
<stop stop-color="#FDE353"/>
</linearGradient>
</defs></g>
</g>
<g id="ohs-upper" class="ohs-move">
<g id="ohs-wingL" style="transform-origin:52px 245px">
<g transform="translate(44.41 301.34)"><path d="M72.0515 34.6636C74.4268 47.5901 71.7087 119.945 52.9016 124.549C34.0944 129.153 4.21789 53.2676 0.17505 31.2664C-2.20026 18.3399 20.109 5.1479 38.9162 0.543497C57.7234 -4.0609 69.6762 21.7371 72.0515 34.6636Z" fill="#284E66"/></g>
<g transform="translate(15.44 215.70) scale(0.7 0.83)"><path d="M1.83484 83.2517C-1.16603 109.409 -2.63285 250.19 15.1128 252.597C32.8584 255.004 65.7274 95.8442 70.8349 51.3242C73.8358 25.167 66.5371 2.4778 48.7915 0.0709793C31.0459 -2.33584 4.83572 57.0946 1.83484 83.2517Z" fill="#61ADDD"/></g>
<g transform="translate(23.74 238.46) scale(0.78 0.82)"><path d="M0.0785939 113.243C-1.06544 142.238 10.1851 289.52 43.1182 290.82C76.0512 292.119 113.287 135.784 115.234 86.4346C116.378 57.4399 88.9431 1.31408 56.01 0.0146575C23.077 -1.28477 1.22263 84.248 0.0785939 113.243Z" fill="#36779F"/></g>
</g>
<g id="ohs-body">
<g transform="translate(42 16)"><path d="M280.046 213.551C293.758 267.683 221.968 394.495 158.108 393.051C47.5459 390.551 13.7058 301.572 2.5497 238.551C-17.4541 125.551 86.0456 1.43246 110.939 0.0513065C135.832 -1.32984 232.046 24.0514 280.046 213.551Z" fill="url(#ohs-paint0_radial_35_202)"/>
<defs>
<radialGradient id="ohs-paint0_radial_35_202" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(82 218.685) rotate(47.7174) scale(216.264 155.018)">
<stop stop-color="#4DB4E8"/>
</radialGradient>
</defs></g>
</g>
<g id="ohs-head" style="transform-origin:200px 110px">
<g id="ohs-cup-left">
<g transform="translate(-121.61 22.29)"><ellipse cx="21.5602" cy="39.7854" rx="21.5602" ry="39.7854" transform="matrix(0.996425 0.0844858 -0.0642146 0.997936 197.556 78.5283)" fill="#090B0D"/></g>
<g transform="translate(-203.40 -30.72)"><ellipse cx="21.5602" cy="39.7854" rx="21.5602" ry="39.7854" transform="matrix(0.996425 0.0844858 -0.0642146 0.997936 265.11 90)" fill="#121921"/></g>
</g>
<g transform="translate(110 18)"><path d="M214.5 13.3665C218 59.8665 173.563 188.366 128 188.366C82.4365 188.366 0 173.93 0 128.366C0 82.8029 26 34.3668 130.5 25.8666C166 17.8667 214.5 -19.6333 214.5 13.3665Z" fill="url(#ohs-paint0_linear_35_204)"/>
<defs>
<linearGradient id="ohs-paint0_linear_35_204" x1="156.954" y1="44.5" x2="107.454" y2="160" gradientUnits="userSpaceOnUse">
<stop offset="0.134615" stop-color="#42A76F"/>
</linearGradient>
</defs></g>
<g transform="translate(118 33)"><path d="M191.293 11.4559C182.449 -6.59802 97.3962 -2.01582 44.1963 16.1483C26.4522 22.2067 -15.0713 68.9495 5.66942 117.628C-1.59959 88.7494 2.01102 49.032 47.7928 29.456C110.09 2.81848 155.793 29.4569 164.793 32.4566C175.436 33.0828 188.106 32.2292 193.334 38.546C195.563 32.0694 195.401 23.214 191.293 11.4559Z" fill="url(#ohs-paint0_linear_35_228)"/>
<defs>
<linearGradient id="ohs-paint0_linear_35_228" x1="128.103" y1="97.229" x2="48.6011" y2="8.85602" gradientUnits="userSpaceOnUse">
<stop offset="0.5625" stop-color="#42A76F"/>
<stop offset="1" stop-color="#80CDA2"/>
</linearGradient>
</defs></g>
<g transform="translate(60 18)"><path d="M12.8554 0.490253C22.8556 -5.00871 52.3553 36.7432 53.8554 75.9902C53.8554 95.4503 54.1164 122.339 48.3857 143.354C49.7402 136.935 50.574 129.554 50.7656 121.124C51.7619 77.2848 31.415 46.3513 13.4629 40.1914C12.2678 38.8769 10.9042 37.6396 9.35544 36.4903C1.00403 30.2928 -8.14445 17.4902 12.8554 0.490253Z" fill="url(#ohs-paint0_linear_35_225)"/>
<defs>
<linearGradient id="ohs-paint0_linear_35_225" x1="37.9999" y1="9.94811" x2="30.38" y2="143.55" gradientUnits="userSpaceOnUse">
<stop offset="0.110577" stop-color="#42A76F"/>
<stop offset="1" stop-color="#74C598"/>
</linearGradient>
</defs></g>
<g transform="translate(48 56)"><path d="M62.9645 80.9808C61.7039 135.99 27.7264 144.966 9.53661 135.968C-17.0171 122.833 19.6177 62.985 26.1702 48.4885C36.2508 24.9941 25.1621 7.49822 25.1621 2.19247e-07C43.3073 5.99857 63.9726 36.9912 62.9645 80.9808Z" fill="url(#ohs-paint0_radial_35_212)"/>
<defs>
<radialGradient id="ohs-paint0_radial_35_212" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(31.0086 82) rotate(114.427) scale(143.879 65.2115)">
<stop offset="0.408654" stop-color="#86D0B9"/>
</radialGradient>
</defs></g>
<g transform="translate(115 54)"><ellipse cx="83" cy="83.5" rx="83" ry="83.5" fill="url(#ohs-paint0_radial_35_206)"/>
<defs>
<radialGradient id="ohs-paint0_radial_35_206" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(64 89) rotate(65.4752) scale(263.8 262.22)">
<stop offset="0.249816" stop-color="#86D0B9"/>
</radialGradient>
</defs></g>
<g id="ohs-eyeL" class="ohs-eye" style="transform-origin:96px 124px"><g id="ohs-irisL"><g transform="translate(67 78)"><ellipse cx="21.1472" cy="43.8914" rx="21.1472" ry="43.8914" transform="matrix(0.952541 0.30441 -0.244199 0.969725 13.3965 -5.94739)" fill="url(#ohs-paint0_linear_35_214)"/>
<defs>
<linearGradient id="ohs-paint0_linear_35_214" x1="21.1472" y1="-1.03176e-06" x2="-131.247" y2="198.877" gradientUnits="userSpaceOnUse">
<stop stop-color="#8AD9A4"/>
<stop offset="1" stop-color="#497357"/>
</linearGradient>
</defs></g></g>
<g transform="translate(79 93)"><ellipse cx="16.125" cy="30.8613" rx="16.125" ry="30.8613" transform="matrix(0.971635 0.236486 -0.188356 0.982101 6.86133 -3.57117)" fill="white"/></g>
<g clip-path="url(#ohs-clipL)"><g id="ohs-pupilL"><g transform="translate(95 108)"><ellipse cx="9.37485" cy="15.354" rx="9.37485" ry="15.354" transform="matrix(0.983697 0.179832 -0.108938 0.994049 1.82422 -1.59167)" fill="#222222"/></g><g transform="translate(101 111)"><circle cx="1.5" cy="1.5" r="1.5" fill="white"/></g></g></g></g>
<path id="ohs-lidL" d="M83 124 Q97 130 112 124" fill="none" stroke="#2E602E" stroke-width="2.5" stroke-linecap="round" opacity="0"/>
<g id="ohs-eyeR" class="ohs-eye" style="transform-origin:198px 137px"><g id="ohs-irisR"><g transform="translate(141.5 80)"><ellipse cx="56.5" cy="57" rx="56.5" ry="57" fill="url(#ohs-paint0_radial_35_207)"/>
<defs>
<radialGradient id="ohs-paint0_radial_35_207" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(19 41.5) rotate(2.2849) scale(200.66 198.899)">
<stop offset="0.346154" stop-color="#8AD9A4"/>
<stop offset="1" stop-color="#497357"/>
</radialGradient>
</defs></g></g>
<g transform="translate(160 95.5)"><ellipse cx="38" cy="41.5" rx="38" ry="41.5" fill="#FFFDFD"/></g>
<g clip-path="url(#ohs-clipR)"><g id="ohs-pupilR"><g transform="translate(177 106)"><ellipse cx="22" cy="27.5" rx="22" ry="27.5" fill="#222222"/></g><g transform="translate(183 114)"><circle cx="3.5" cy="3.5" r="3.5" fill="white"/></g></g></g></g>
<path id="ohs-lidR" d="M162 137 Q198 152 234 137" fill="none" stroke="#2E602E" stroke-width="3.5" stroke-linecap="round" opacity="0"/>
<g id="ohs-brows">
<g transform="translate(60 60)"><path d="M2.00361 3.82477C2.00361 3.82477 13.181 0.61026 21.9486 0.0301951C30.7162 -0.54987 45.3663 7.43131 45.3663 7.43131L44.9019 14.1677C44.9019 14.1677 30.5684 10.7297 21.8007 11.3098C13.0331 11.8898 3.71208e-05 17.1383 3.71208e-05 17.1383L2.00361 3.82477Z" fill="url(#ohs-paint0_linear_35_224)"/>
<defs>
<linearGradient id="ohs-paint0_linear_35_224" x1="21.8727" y1="0.0352146" x2="22.904" y2="15.623" gradientUnits="userSpaceOnUse">
<stop stop-color="#2E602E"/>
<stop offset="1" stop-color="#243F24"/>
</linearGradient>
</defs></g>
<g transform="translate(162 46)"><path d="M0.000175779 11.0789C0.000175779 11.0789 48.3359 -3.3283 74.587 0.716101C100.838 4.7605 130.443 11.5603 130.443 11.5603L135.723 31.4286C135.723 31.4286 95.6638 19.27 69.4127 15.2256C43.1617 11.1812 0.413198 18.8791 0.413198 18.8791L0.000175779 11.0789Z" fill="url(#ohs-paint0_linear_35_236)"/>
<defs>
<linearGradient id="ohs-paint0_linear_35_236" x1="71.5604" y1="-0.242497" x2="64.413" y2="37.2466" gradientUnits="userSpaceOnUse">
<stop stop-color="#2E602E"/>
<stop offset="1" stop-color="#243F24"/>
</linearGradient>
</defs></g>
</g>
<g id="ohs-headband">
<g transform="translate(-138.80 -15.00)"><path d="M232.34 75.4289C232.34 75.4289 251.301 64.5138 262.34 56.929C285.645 40.9163 299.122 47.7476 327.34 45.929C355.145 44.137 358.776 43.7774 383.34 56.929C404.429 68.2202 431.34 83.9289 431.34 83.9289L433.84 88.0272L428.009 88.0272C428.009 88.0272 401.444 75.2383 383.34 64.929C360.864 52.1306 353.343 50.5787 327.34 51.929C301.337 53.2793 286.767 48.6339 265.34 63.429C255.796 70.0189 240.84 75.4289 240.84 75.4289L232.34 75.4289Z" fill="#282C31"/></g>
<g transform="translate(-154.82 26.13)"><path d="M239.34 31.4289C239.34 31.4289 258.301 20.5138 269.34 12.929C292.645 -3.08374 306.122 3.74755 334.34 1.92898C362.145 0.136975 365.776 -0.222592 390.34 12.929C411.429 24.2202 438.34 39.9289 438.34 39.9289L440.84 44.0272L435.009 44.0272C435.009 44.0272 408.444 31.2383 390.34 20.929C367.864 8.13062 360.344 6.57866 334.34 7.92896C308.337 9.27926 293.767 4.63388 272.34 19.429C262.796 26.0189 247.84 31.4289 247.84 31.4289L239.34 31.4289Z" fill="#1C1E21"/></g>
</g>
<g id="ohs-cap" style="transform-origin:160px 30px">
<g transform="translate(89 5)"><path d="M10.2222 0.0568023C28.2916 0.0568123 90.2223 2.91033 128.222 0.0568021C152.222 -1.74544 143.222 39.9376 143.222 39.9376C143.222 39.9376 136.173 51.4468 110.722 52.9221C94.7222 53.8496 10.2223 65.9106 10.2222 50.1397C10.2221 30.5811 -12.7777 0.0567895 10.2222 0.0568023Z" fill="#00345E"/></g>
<g transform="translate(92 33)"><path d="M0 2C0 2 30 5.5 49 5.5C84.564 5.5 140 0 140 0L139.5 5.5C139.5 5.5 84.56 11.0318 49 10.5C30.6308 10.2253 2 8.5 2 8.5L0 2Z" fill="#FEF05A"/></g>
<g transform="translate(68 48)"><path d="M0.502869 10.2752C-9.76122 -8.72476 140.503 4.44414 140.503 4.44414L98.5029 15.4441C98.5029 15.4441 80.0029 23.6131 48.5029 12.4441C45.6937 11.4481 1.91951 12.8976 0.502869 10.2752Z" fill="#145080"/></g>
</g>
<g id="ohs-beak">
<path id="ohs-mouth" d="M76 174 L113 170 L123 157 L121 172 Q104 186 80 180 Z" fill="#5A2A1A" opacity="0"/>
<g id="ohs-beak-lower" style="transform-origin:122px 160px">
<g transform="translate(88 151)"><path d="M0.00038915 20.2465C0.00038915 20.2465 8.49679 23.3497 12.6594 24.2775C17.0428 25.2545 34.7949 21.5308 34.7949 12C34.7949 6.00002 36.2948 2.18081e-05 33.7948 1.49114e-05C18.7645 -2.61917e-05 16.9429 16.2213 16.9429 16.2213L0.00038915 20.2465Z" fill="url(#ohs-paint0_linear_35_231)"/>
<defs>
<linearGradient id="ohs-paint0_linear_35_231" x1="16.8799" y1="24.6065" x2="17.7948" y2="-0.499977" gradientUnits="userSpaceOnUse">
<stop stop-color="#BD9F28"/>
</linearGradient>
</defs></g>
</g>
<g id="ohs-beak-upper" style="transform-origin:122px 156px">
<g transform="translate(73 143)"><path d="M0.000338672 31.8548C0.000338672 31.8548 5.47172 23.6429 9.50266 18.7894C13.4967 13.9803 20.4931 7.15066 20.4931 7.15066C20.4931 7.15066 40.1604 -8.56262 49.0231 6.59705C57.9038 21.7875 37.0467 31.5889 37.0467 31.5889L0.000338672 31.8548Z" fill="url(#ohs-paint0_radial_35_232)"/>
<defs>
<radialGradient id="ohs-paint0_radial_35_232" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(29.2889 9.32149) rotate(67.4259) scale(48.1923 88.9418)">
<stop stop-color="#FFE204"/>
</radialGradient>
</defs></g>
</g>
</g>
<g id="ohs-mic">
<g transform="translate(-136.07 -20.01)"><path d="M179.879 199.279C179.879 199.279 189.192 203.751 195.592 205.141C202.314 206.602 215.631 206.699 215.631 206.699L215.998 210.321C215.998 210.321 201.594 210.788 194.798 209.571C188.003 208.353 178.013 204.024 178.013 204.024C178.013 204.024 177.542 201.884 178.05 200.983C178.557 200.082 179.879 199.279 179.879 199.279Z" fill="#121921"/></g>
<g transform="translate(-192.57 -54.18)"><ellipse cx="276.754" cy="239.843" rx="4" ry="10" transform="rotate(65.0688 276.754 239.843)" fill="#232A32"/></g>
</g>
<g id="ohs-cup-right">
<g transform="translate(-111.79 -62.47)"><ellipse cx="397.304" cy="180.877" rx="29.8073" ry="50" transform="rotate(-1.73044 397.304 180.877)" fill="#090B0D"/></g>
<g transform="translate(-239.03 30.66)"><ellipse cx="532.304" cy="88.8774" rx="29.8073" ry="50" transform="rotate(-1.73044 532.304 88.8774)" fill="#1D232A"/></g>
</g>
</g>
<g id="ohs-bag">
<g id="ohs-bag-body" transform="translate(-62.44 25.13)"><path d="M284 283L387.838 283L404 378L284 406L284 283Z" fill="#6D5A48"/></g>
<g id="ohs-strap" transform="translate(30.45 27.56)"><path d="M8.10431 162L205.981 289.068C205.981 289.068 206.944 297.863 207.335 301.431C207.725 305 207.982 307.344 207.982 307.344L8.27003 179.562C8.27003 179.562 7.29545 173.948 7.26928 170.424C7.2445 167.088 8.10431 162 8.10431 162Z" fill="#7B6048"/></g>
<g id="ohs-bag-flap" transform="translate(96.56 -36.87)"><path d="M125 345H228.489L239 404.386L125 422V345Z" fill="#87715D"/></g>
<g id="ohs-bag-clasp" transform="translate(-144.72 -36.56)"><path d="M429 407L457 406L459 418.5L431 423L429 407Z" fill="#C7B65A"/></g>
</g>
<g id="ohs-wing-raised" style="transform-origin:270px 235px">
<g transform="translate(-159.73 -15.07)"><path d="M478.492 229.431C473.437 219.321 411.797 148.638 462.476 163.229C513.155 177.82 585.372 251.917 593.976 269.124C599.031 279.234 557.234 300.137 506.555 285.546C455.876 270.955 483.547 239.541 478.492 229.431Z" fill="#284E66"/></g>
<g transform="translate(-355.14 16.40)"><path d="M766.902 248.369C772.846 231.683 757.478 131.132 669.668 99.8522C581.857 68.5726 711.899 188.452 659.295 197.43C624.183 203.422 576.429 207.16 611.512 239.788C690.929 274.16 760.958 265.055 766.902 248.369Z" fill="#36779F"/></g>
<g transform="translate(-221.01 -148.41)"><path d="M677.24 423.892C682.801 409.834 634.716 311.804 587.038 294.994C539.359 278.184 634.441 378.459 624.976 402.386C619.415 416.445 507.238 404.286 554.916 421.096C602.595 437.906 671.679 437.951 677.24 423.892Z" fill="#61ADDD"/></g>
</g>
</g>
`,
  },
};

const rand = (min: number, max: number) => min + Math.random() * (max - min);

type OwlHelperProps = {
  pose: OwlPose;
  /* Change this number to make him react
     (FAQs: a question was opened · Support: a message was sent). */
  nudge?: number;
};

export default function OwlHelper({ pose, nudge = 0 }: OwlHelperProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const actRef = useRef<(reacting?: boolean) => void>(() => {});
  const art = POSES[pose];

  useEffect(() => {
    const root = svgRef.current;
    if (!root) return undefined;

    const thinkingPose = pose === "thinking";
    const $ = (id: string) => root.querySelector<SVGGElement>(`#${art.prefix}-${id}`);
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

    /* ---- gaze ---- */
    const gaze = [
      { el: $("pupilR"), rx: 14, ry: 12, k: 1 },
      { el: $("irisR"), rx: 14, ry: 12, k: 0.35 },
      { el: $("pupilL"), rx: 5, ry: 13, k: 1 },
      { el: $("irisL"), rx: 5, ry: 13, k: 0.35 },
    ];
    let current = { x: 0, y: 0 };
    let gazeAnims: Animation[] = [];
    let readingUntil = 0;

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

    /* thinking: always up-right toward the question marks, with small drifts */
    const gazeUp = () => {
      if (!document.hidden && Date.now() > readingUntil) {
        lookAt(rand(0.75, 1), rand(-0.95, -0.65), rand(400, 700));
      }
      later(gazeUp, rand(1500, 3500));
    };

    /* headset: glances around, then back to the front */
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

    /* ---- talking: bursts of syllables (headset pose) ---- */
    let talking = false;
    let acting = false;

    const talk = () => {
      if (talking || acting || document.hidden) return;
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

    /* ---- the pose's gesture: chin tap ("hmm") or earpiece press ---- */
    const act = (reacting = false) => {
      if (thinkingPose && reacting) {
        // glance down at the answer that was just opened, then back up
        readingUntil = Date.now() + 1500;
        lookAt(-0.85, 0.75, 300);
        later(() => lookAt(0.85, -0.8, 500), 1500);
      }
      if (acting) return;
      acting = true;

      const angle = thinkingPose ? (reduce ? 2 : 6) : reduce ? 1.5 : 5;
      const wingFrames = thinkingPose ? [0, -angle, 0, -angle, 0] : [0, -angle, -angle * 0.6, -angle, 0];
      const animation = $("wing-raised")?.animate(
        wingFrames.map((r) => ({ transform: `rotate(${r}deg)` })),
        { duration: reduce ? 500 : thinkingPose ? 900 : 1000, easing: "ease-in-out" }
      );
      const tilt = thinkingPose ? 4 : 3;
      $("head")?.animate(
        [{ transform: "rotate(0)" }, { transform: `rotate(${tilt}deg)`, offset: 0.3 }, { transform: `rotate(${tilt}deg)`, offset: thinkingPose ? 0.75 : 0.7 }, { transform: "rotate(0)" }],
        { duration: thinkingPose ? 1400 : 1000, easing: "ease-in-out" }
      );
      if (!thinkingPose) {
        $("cap")?.animate(
          [{ transform: "translateY(0)" }, { transform: "translateY(-4px)", offset: 0.3 }, { transform: "translateY(0)", offset: 0.6 }],
          { duration: 1000, easing: "ease-out" }
        );
      }

      const done = () => {
        acting = false;
        // a message just came in: the support owl answers it
        if (!thinkingPose && reacting) talk();
      };
      if (animation) {
        animation.onfinish = done;
        animation.oncancel = () => {
          acting = false;
        };
      } else {
        done();
      }
    };
    actRef.current = act;

    const idleActLoop = () =>
      later(() => {
        if (!document.hidden) act();
        idleActLoop();
      }, rand(7000, 14000));

    blinkLoop();
    if (thinkingPose) {
      lookAt(0.85, -0.8, 0);
      later(gazeUp, 1500);
      idleActLoop();
    } else {
      later(glance, 1500);
      talkLoop();
      later(talk, 2200);
    }
    later(() => act(), 600);

    return () => {
      alive = false;
      timers.forEach((id) => window.clearTimeout(id));
      gazeAnims.forEach((animation) => animation.cancel());
      actRef.current = () => {};
    };
  }, [pose, art.prefix]);

  /* FAQs: a question was opened · Support: a message was sent */
  useEffect(() => {
    if (nudge > 0) actRef.current(true);
  }, [nudge]);

  const onAct = () => actRef.current();

  return (
    <svg
      key={pose}
      ref={svgRef}
      className={`owlh owlh--${pose}`}
      viewBox={art.viewBox}
      xmlns="http://www.w3.org/2000/svg"
      role="button"
      tabIndex={0}
      aria-label={art.label}
      onClick={onAct}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onAct();
        }
      }}
      dangerouslySetInnerHTML={{ __html: art.svg }}
    />
  );
}
