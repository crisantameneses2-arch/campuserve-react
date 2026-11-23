// Original CampuServe owl artwork (from the CampuServe design preview).
// Kept as a static, trusted SVG string so the artwork stays byte-for-byte identical.
// Element ids (wingL, wingR, eyeL, eyeR, pupilL, pupilR, irisL, irisR, lidL, lidR)
// are used by OwlMascot.tsx for the eye-tracking, blink and wing-flap animations.
export const OWL_SVG_INNER = `<defs>
<clipPath id="clipR"><ellipse cx="198" cy="137" rx="38" ry="41.5"/></clipPath>
<clipPath id="clipL"><ellipse cx="16.125" cy="30.86" rx="16.125" ry="30.86" transform="translate(79 93) matrix(0.971635 0.236486 -0.188356 0.982101 6.86133 -3.57117)"/></clipPath>
<linearGradient id="gwDark" x1="0" y1="0" x2="0.3" y2="1"><stop stop-color="#3F7496"/><stop offset="0.5" stop-color="#2A5875"/><stop offset="1" stop-color="#17344A"/></linearGradient>
<linearGradient id="gwMid" x1="0" y1="0" x2="0.3" y2="1"><stop stop-color="#66B0DB"/><stop offset="0.5" stop-color="#3C84B0"/><stop offset="1" stop-color="#23628A"/></linearGradient>
<linearGradient id="gwLight" x1="0" y1="0" x2="0.3" y2="1"><stop stop-color="#B2E3FB"/><stop offset="0.5" stop-color="#7BC1EB"/><stop offset="1" stop-color="#4A97CB"/></linearGradient>
<linearGradient id="gBranch" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#876A50"/><stop offset="1" stop-color="#6D533D"/></linearGradient>
<linearGradient id="gTail" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#917B66"/><stop offset="1" stop-color="#7C6753"/></linearGradient>
</defs>
<g transform="translate(202 350)"><path d="M0 0H128L141 59L0 76.5V0Z" fill="url(#gTail)"/></g>
<g transform="translate(148 405)"><path d="M0 0L17 -2.33313e-08L17 100L1.37243e-07 100L0 0Z" fill="url(#paint0_linear_35_194)"/>
<defs>
<linearGradient id="paint0_linear_35_194" x1="8.5" y1="-1.16656e-08" x2="8.5" y2="100" gradientUnits="userSpaceOnUse">
<stop stop-color="#D8D23A"/><stop offset="1" stop-color="#EFE946"/>
</linearGradient>
</defs></g>
<g transform="translate(197 395)"><path d="M0 0L17 -2.33313e-08L17 100L1.37243e-07 100L0 0Z" fill="url(#paint0_linear_35_195)"/>
<defs>
<linearGradient id="paint0_linear_35_195" x1="8.5" y1="-1.16656e-08" x2="8.5" y2="100" gradientUnits="userSpaceOnUse">
<stop stop-color="#E3DD3D"/><stop offset="1" stop-color="#FAF446"/>
</linearGradient>
</defs></g>
<g transform="translate(88 482)"><path d="M3.5 13.9132C19 -12.5868 90.5 6.91325 90.5 6.91325L89 23.4133L3.62502e-08 26.4132C3.62502e-08 26.4132 0.940591 18.289 3.5 13.9132Z" fill="url(#paint0_linear_35_196)"/>
<defs>
<linearGradient id="paint0_linear_35_196" x1="21" y1="13" x2="24" y2="68" gradientUnits="userSpaceOnUse">
<stop stop-color="#F5DE57"/><stop offset="1" stop-color="#D9BE3A"/>
</linearGradient>
</defs></g>
<g transform="translate(140 492)"><path d="M3.5 13.9132C19 -12.5868 90.5 6.91325 90.5 6.91325L89 23.4133L3.62502e-08 26.4132C3.62502e-08 26.4132 0.940591 18.289 3.5 13.9132Z" fill="url(#paint0_linear_35_197)"/>
<defs>
<linearGradient id="paint0_linear_35_197" x1="28.5" y1="-9.48865e-07" x2="64.5" y2="71.5" gradientUnits="userSpaceOnUse">
<stop stop-color="#FDE75F"/><stop offset="1" stop-color="#DFC43E"/>
</linearGradient>
</defs></g>
<g id="wingLback" style="filter:brightness(.82)"><g transform="translate(-10 4)"><g id="wingL" class="wing" style="transform-origin:52px 245px"><g transform="translate(48 320)"><path d="M72.0515 34.6636C74.4268 47.5901 71.7087 119.945 52.9016 124.549C34.0944 129.153 4.21789 53.2676 0.17505 31.2664C-2.20026 18.3399 20.109 5.1479 38.9162 0.543497C57.7234 -4.0609 69.6762 21.7371 72.0515 34.6636Z" fill="url(#gwDark)"/></g>
<g transform="translate(14 248) scale(0.7 0.83)"><path d="M1.83484 83.2517C-1.16603 109.409 -2.63285 250.19 15.1128 252.597C32.8584 255.004 65.7274 95.8442 70.8349 51.3242C73.8358 25.167 66.5371 2.4778 48.7915 0.0709793C31.0459 -2.33584 4.83572 57.0946 1.83484 83.2517Z" fill="url(#gwLight)"/></g>
<g transform="translate(18 232) scale(0.78 0.82)"><path d="M0.0785939 113.243C-1.06544 142.238 10.1851 289.52 43.1182 290.82C76.0512 292.119 113.287 135.784 115.234 86.4346C116.378 57.4399 88.9431 1.31408 56.01 0.0146575C23.077 -1.28477 1.22263 84.248 0.0785939 113.243Z" fill="url(#gwMid)"/></g></g></g></g>
<g transform="translate(42 16)"><path d="M280.046 213.551C293.758 267.683 221.968 394.495 158.108 393.051C47.5459 390.551 13.7058 301.572 2.5497 238.551C-17.4541 125.551 86.0456 1.43246 110.939 0.0513065C135.832 -1.32984 232.046 24.0514 280.046 213.551Z" fill="url(#paint0_radial_35_202)"/>
<defs>
<radialGradient id="paint0_radial_35_202" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(110 235) rotate(55) scale(250 190)">
<stop stop-color="#82D6FA"/><stop offset="0.45" stop-color="#4DB2E8"/><stop offset="1" stop-color="#2873A8"/>
</radialGradient>
</defs></g>
<defs><radialGradient id="gChest" cx="0.5" cy="0.5" r="0.5"><stop stop-color="#C9F0FF" stop-opacity=".55"/><stop offset="1" stop-color="#C9F0FF" stop-opacity="0"/></radialGradient></defs>
<ellipse cx="170" cy="318" rx="78" ry="88" fill="url(#gChest)"/>
<g transform="translate(110 18)"><path d="M214.5 13.3665C218 59.8665 173.563 188.366 128 188.366C82.4365 188.366 0 173.93 0 128.366C0 82.8029 26 34.3668 130.5 25.8666C166 17.8667 214.5 -19.6333 214.5 13.3665Z" fill="url(#paint0_linear_35_204)"/>
<defs>
<linearGradient id="paint0_linear_35_204" x1="156.954" y1="44.5" x2="107.454" y2="160" gradientUnits="userSpaceOnUse">
<stop offset="0.134615" stop-color="#42A76F"/>
</linearGradient>
</defs></g>
<g transform="translate(118 33)"><path d="M191.293 11.4559C182.449 -6.59802 97.3962 -2.01582 44.1963 16.1483C26.4522 22.2067 -15.0713 68.9495 5.66942 117.628C-1.59959 88.7494 2.01102 49.032 47.7928 29.456C110.09 2.81848 155.793 29.4569 164.793 32.4566C175.436 33.0828 188.106 32.2292 193.334 38.546C195.563 32.0694 195.401 23.214 191.293 11.4559Z" fill="url(#paint0_linear_35_228)"/>
<defs>
<linearGradient id="paint0_linear_35_228" x1="128.103" y1="97.229" x2="48.6011" y2="8.85602" gradientUnits="userSpaceOnUse">
<stop offset="0.5625" stop-color="#42A76F"/>
<stop offset="1" stop-color="#80CDA2"/>
</linearGradient>
</defs></g>
<g transform="translate(60 18)"><path d="M12.8554 0.490253C22.8556 -5.00871 52.3553 36.7432 53.8554 75.9902C53.8554 95.4503 54.1164 122.339 48.3857 143.354C49.7402 136.935 50.574 129.554 50.7656 121.124C51.7619 77.2848 31.415 46.3513 13.4629 40.1914C12.2678 38.8769 10.9042 37.6396 9.35544 36.4903C1.00403 30.2928 -8.14445 17.4902 12.8554 0.490253Z" fill="url(#paint0_linear_35_225)"/>
<defs>
<linearGradient id="paint0_linear_35_225" x1="37.9999" y1="9.94811" x2="30.38" y2="143.55" gradientUnits="userSpaceOnUse">
<stop offset="0.110577" stop-color="#42A76F"/>
<stop offset="1" stop-color="#74C598"/>
</linearGradient>
</defs></g>
<g transform="translate(48 56)"><path d="M62.9645 80.9808C61.7039 135.99 27.7264 144.966 9.53661 135.968C-17.0171 122.833 19.6177 62.985 26.1702 48.4885C36.2508 24.9941 25.1621 7.49822 25.1621 2.19247e-07C43.3073 5.99857 63.9726 36.9912 62.9645 80.9808Z" fill="url(#paint0_radial_35_212)"/>
<defs>
<radialGradient id="paint0_radial_35_212" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(31.0086 82) rotate(114.427) scale(143.879 65.2115)">
<stop offset="0.408654" stop-color="#86D0B9"/><stop offset="1" stop-color="#70BBA5"/>
</radialGradient>
</defs></g>
<g transform="translate(115 54)"><ellipse cx="83" cy="83.5" rx="83" ry="83.5" fill="url(#paint0_radial_35_206)"/>
<defs>
<radialGradient id="paint0_radial_35_206" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(64 89) rotate(65.4752) scale(263.8 262.22)">
<stop offset="0.249816" stop-color="#86D0B9"/><stop offset="1" stop-color="#63AF99"/>
</radialGradient>
</defs></g>
<g id="eyeL" class="eye" style="transform-origin:96px 124px"><g id="irisL"><g transform="translate(67 78)"><ellipse cx="21.1472" cy="43.8914" rx="21.1472" ry="43.8914" transform="matrix(0.952541 0.30441 -0.244199 0.969725 13.3965 -5.94739)" fill="url(#paint0_linear_35_214)"/>
<defs>
<linearGradient id="paint0_linear_35_214" x1="21.1472" y1="-1.03176e-06" x2="-131.247" y2="198.877" gradientUnits="userSpaceOnUse">
<stop stop-color="#8AD9A4"/>
<stop offset="1" stop-color="#497357"/>
</linearGradient>
</defs></g></g>
<g transform="translate(79 93)"><ellipse cx="16.125" cy="30.8613" rx="16.125" ry="30.8613" transform="matrix(0.971635 0.236486 -0.188356 0.982101 6.86133 -3.57117)" fill="white"/></g>
<g clip-path="url(#clipL)"><g id="pupilL"><g transform="translate(95 108)"><ellipse cx="9.37485" cy="15.354" rx="9.37485" ry="15.354" transform="matrix(0.983697 0.179832 -0.108938 0.994049 1.82422 -1.59167)" fill="#222222"/></g><g transform="translate(101 111)"><circle cx="1.5" cy="1.5" r="1.5" fill="white"/></g></g></g></g>
<path id="lidL" d="M83 124 Q97 130 112 124" fill="none" stroke="#2E602E" stroke-width="2.5" stroke-linecap="round" opacity="0"/>
<g id="eyeR" class="eye" style="transform-origin:198px 137px"><g id="irisR"><g transform="translate(141.5 80)"><ellipse cx="56.5" cy="57" rx="56.5" ry="57" fill="url(#paint0_radial_35_207)"/>
<defs>
<radialGradient id="paint0_radial_35_207" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(19 41.5) rotate(2.2849) scale(200.66 198.899)">
<stop offset="0.346154" stop-color="#8AD9A4"/>
<stop offset="1" stop-color="#497357"/>
</radialGradient>
</defs></g></g>
<g transform="translate(160 95.5)"><ellipse cx="38" cy="41.5" rx="38" ry="41.5" fill="#FFFDFD"/></g>
<g clip-path="url(#clipR)"><g id="pupilR"><g transform="translate(177 106)"><ellipse cx="22" cy="27.5" rx="22" ry="27.5" fill="#222222"/></g><g transform="translate(183 114)"><circle cx="3.5" cy="3.5" r="3.5" fill="white"/></g></g></g></g>
<path id="lidR" d="M162 137 Q198 152 234 137" fill="none" stroke="#2E602E" stroke-width="3.5" stroke-linecap="round" opacity="0"/>
<g transform="translate(60 60)"><path d="M2.00361 3.82477C2.00361 3.82477 13.181 0.61026 21.9486 0.0301951C30.7162 -0.54987 45.3663 7.43131 45.3663 7.43131L44.9019 14.1677C44.9019 14.1677 30.5684 10.7297 21.8007 11.3098C13.0331 11.8898 3.71208e-05 17.1383 3.71208e-05 17.1383L2.00361 3.82477Z" fill="url(#paint0_linear_35_224)"/>
<defs>
<linearGradient id="paint0_linear_35_224" x1="21.8727" y1="0.0352146" x2="22.904" y2="15.623" gradientUnits="userSpaceOnUse">
<stop stop-color="#2E602E"/>
<stop offset="1" stop-color="#243F24"/>
</linearGradient>
</defs></g>
<g transform="translate(162 46)"><path d="M0.000175779 11.0789C0.000175779 11.0789 48.3359 -3.3283 74.587 0.716101C100.838 4.7605 130.443 11.5603 130.443 11.5603L135.723 31.4286C135.723 31.4286 95.6638 19.27 69.4127 15.2256C43.1617 11.1812 0.413198 18.8791 0.413198 18.8791L0.000175779 11.0789Z" fill="url(#paint0_linear_35_236)"/>
<defs>
<linearGradient id="paint0_linear_35_236" x1="71.5604" y1="-0.242497" x2="64.413" y2="37.2466" gradientUnits="userSpaceOnUse">
<stop stop-color="#2E602E"/>
<stop offset="1" stop-color="#243F24"/>
</linearGradient>
</defs></g>
<g transform="translate(89 5)"><path d="M10.2222 0.0568023C28.2916 0.0568123 90.2223 2.91033 128.222 0.0568021C152.222 -1.74544 143.222 39.9376 143.222 39.9376C143.222 39.9376 136.173 51.4468 110.722 52.9221C94.7222 53.8496 10.2223 65.9106 10.2222 50.1397C10.2221 30.5811 -12.7777 0.0567895 10.2222 0.0568023Z" fill="#00345E"/></g>
<g transform="translate(92 33)"><path d="M0 2C0 2 30 5.5 49 5.5C84.564 5.5 140 0 140 0L139.5 5.5C139.5 5.5 84.56 11.0318 49 10.5C30.6308 10.2253 2 8.5 2 8.5L0 2Z" fill="#FEF05A"/></g>
<g transform="translate(68 48)"><path d="M0.502869 10.2752C-9.76122 -8.72476 140.503 4.44414 140.503 4.44414L98.5029 15.4441C98.5029 15.4441 80.0029 23.6131 48.5029 12.4441C45.6937 11.4481 1.91951 12.8976 0.502869 10.2752Z" fill="#145080"/></g>
<g transform="translate(88 151)"><path d="M0.00038915 20.2465C0.00038915 20.2465 8.49679 23.3497 12.6594 24.2775C17.0428 25.2545 34.7949 21.5308 34.7949 12C34.7949 6.00002 36.2948 2.18081e-05 33.7948 1.49114e-05C18.7645 -2.61917e-05 16.9429 16.2213 16.9429 16.2213L0.00038915 20.2465Z" fill="url(#paint0_linear_35_231)"/>
<defs>
<linearGradient id="paint0_linear_35_231" x1="16.8799" y1="24.6065" x2="17.7948" y2="-0.499977" gradientUnits="userSpaceOnUse">
<stop stop-color="#BD9F28"/>
</linearGradient>
</defs></g>
<g transform="translate(73 143)"><path d="M0.000338672 31.8548C0.000338672 31.8548 5.47172 23.6429 9.50266 18.7894C13.4967 13.9803 20.4931 7.15066 20.4931 7.15066C20.4931 7.15066 40.1604 -8.56262 49.0231 6.59705C57.9038 21.7875 37.0467 31.5889 37.0467 31.5889L0.000338672 31.8548Z" fill="url(#paint0_radial_35_232)"/>
<defs>
<radialGradient id="paint0_radial_35_232" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(29.2889 9.32149) rotate(67.4259) scale(48.1923 88.9418)">
<stop stop-color="#FFE836"/><stop offset="1" stop-color="#EDC200"/>
</radialGradient>
</defs></g>
<g transform="translate(38 208)"><path d="M1.63672 0L158.637 101C158.637 101 158.637 109.181 158.637 112.5C158.637 115.819 158.637 118 158.637 118L0.136723 16.5C0.136723 16.5 -0.170256 11.311 0.136722 8C0.42739 4.86494 1.63672 0 1.63672 0Z" fill="url(#gBranch)"/></g>
<g id="wingR" class="wing" style="transform-origin:262px 232px"><g transform="translate(186 345)"><path d="M7.42326 27.9517C1.89257 40.0965 -8.86541 111.698 13.9549 120.471C36.7753 129.244 89.3401 61.5517 98.7535 40.8811C104.284 28.7363 78.7301 10.7461 55.9097 1.97353C33.0894 -6.79905 12.9539 15.807 7.42326 27.9517Z" fill="url(#gwDark)"/></g>
<g transform="translate(192 217)"><path d="M141.654 124.277C137.412 152.982 94.3431 294.936 52.547 288.76C10.7508 282.583 -5.56557 120.778 1.65426 71.9208C5.8962 43.2152 51.5074 -5.6424 93.3036 0.533983C135.1 6.71036 145.896 95.5712 141.654 124.277Z" fill="url(#gwMid)"/></g>
<g transform="translate(251 243)"><path d="M81.0881 92.3258C79.7447 118.668 53.992 257.12 31.1359 255.466C8.27993 253.812 -1.97423 90.2243 0.312198 45.3901C1.65558 19.0483 15.3107 -1.56071 38.1667 0.0929871C61.0227 1.74668 82.4314 65.984 81.0881 92.3258Z" fill="url(#gwLight)"/></g></g>`;
