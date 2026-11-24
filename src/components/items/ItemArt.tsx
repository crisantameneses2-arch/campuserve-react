/*
 * Built-in illustrations for campus items (original CampuServe artwork).
 *
 * The right drawing is picked from the item's name, e.g.
 *   "ID Lace"          → lanyard with ID card
 *   "PE Shirt"         → PE T-shirt
 *   "PE Pants"         → jogging pants
 *   "Female Blouse"    → blouse
 *   "Male Polo"        → polo
 *   "Skirt" / "Slacks" → skirt / slacks
 *   "... Fabric"       → folded fabric
 *   anything else      → campus bag
 *
 * These are used whenever an item has no uploaded photo, and as a
 * fallback if an uploaded photo fails to load.
 */

import type { ReactElement } from "react";
import { getItemArtKind, type ItemArtKind } from "./itemArtKind";

export default function ItemArt({
  itemName,
  className,
}: {
  itemName: string;
  className?: string;
}) {
  const kind = getItemArtKind(itemName);

  return (
    <svg
      className={className}
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={itemName}
    >
      {ART[kind]}
    </svg>
  );
}

const shadow = (
  <ellipse cx="100" cy="182" rx="58" ry="8" fill="#0f2f22" opacity=".1" />
);

const ART: Record<ItemArtKind, ReactElement> = {
  lace: (
    <g>
      {shadow}
      {/* lanyard */}
      <path
        d="M64 18c-8 52 10 92 36 104 26-12 44-52 36-104"
        stroke="#2E602E"
        strokeWidth="13"
        strokeLinecap="round"
      />
      <path
        d="M64 18c-8 52 10 92 36 104 26-12 44-52 36-104"
        stroke="#F5DE57"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray="1 9"
      />
      {/* clip */}
      <rect x="91" y="114" width="18" height="18" rx="4" fill="#B9C6BE" stroke="#4F6B5D" strokeWidth="2.5" />
      {/* card */}
      <rect x="60" y="128" width="80" height="56" rx="9" fill="#FFFFFF" stroke="#2D5873" strokeWidth="3" transform="rotate(-4 100 156)" />
      <g transform="rotate(-4 100 156)">
        <rect x="60" y="128" width="80" height="14" rx="7" fill="#2D5873" />
        <rect x="68" y="148" width="22" height="26" rx="4" fill="#DCEFE5" />
        <circle cx="79" cy="157" r="5" fill="#86D0B9" />
        <path d="M71 172c2-6 14-6 16 0" stroke="#42A76F" strokeWidth="3" strokeLinecap="round" />
        <path d="M97 153h33M97 162h25M97 171h30" stroke="#AFC3CF" strokeWidth="4" strokeLinecap="round" />
      </g>
    </g>
  ),

  peShirt: (
    <g>
      {shadow}
      <path
        d="M66 34l21-10c4 11 22 11 26 0l21 10 34 27-18 25-15-10v94H65V76L50 86 32 61z"
        fill="#2E8A57"
        stroke="#1F5C3A"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      {/* sleeve stripes */}
      <path d="M44 70l16 13M156 70l-16 13" stroke="#F5DE57" strokeWidth="5" strokeLinecap="round" />
      {/* collar */}
      <path d="M87 24c4 13 22 13 26 0" stroke="#F5DE57" strokeWidth="5" strokeLinecap="round" />
      {/* chest band */}
      <path d="M65 110h70" stroke="#F5DE57" strokeWidth="7" />
      <path d="M65 122h70" stroke="#FFFFFF" strokeWidth="3" opacity=".7" />
      {/* logo */}
      <circle cx="117" cy="68" r="9" fill="#FFFFFF" opacity=".9" />
      <path d="m113 68 3 3 6-7" stroke="#2E8A57" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  ),

  pePants: (
    <g>
      {shadow}
      <path
        d="M62 26h76l8 148h-38l-8-92-8 92H54z"
        fill="#1F5C3A"
        stroke="#163F29"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      {/* waistband */}
      <rect x="60" y="22" width="80" height="16" rx="5" fill="#2E8A57" stroke="#163F29" strokeWidth="3" />
      <path d="M96 38v12M104 38v14" stroke="#F5DE57" strokeWidth="3" strokeLinecap="round" />
      {/* side stripes */}
      <path d="M63 44 57 170M137 44l6 126" stroke="#F5DE57" strokeWidth="5" strokeLinecap="round" />
      {/* cuffs */}
      <path d="M56 162h34M110 162h34" stroke="#2E8A57" strokeWidth="7" />
    </g>
  ),

  blouse: (
    <g>
      {shadow}
      <path
        d="M68 34l18-10c6 10 22 10 28 0l18 10 30 32-17 21-13-11v91H68V76L55 87 38 66z"
        fill="#FFFFFF"
        stroke="#5E86A3"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      {/* rounded collar */}
      <path d="M86 24c-10 14-6 26 8 26l6-10 6 10c14 0 18-12 8-26" fill="#EAF3F9" stroke="#5E86A3" strokeWidth="3" strokeLinejoin="round" />
      {/* ribbon */}
      <path d="M100 52l-15 9 3 6 12-8 12 8 3-6z" fill="#2D5873" />
      <path d="M96 60l-6 24M104 60l6 24" stroke="#2D5873" strokeWidth="5" strokeLinecap="round" />
      {/* buttons */}
      <circle cx="100" cy="104" r="3" fill="#9DB4C6" />
      <circle cx="100" cy="124" r="3" fill="#9DB4C6" />
      <circle cx="100" cy="144" r="3" fill="#9DB4C6" />
      {/* cuffs */}
      <path d="M45 72l14 11M155 72l-14 11" stroke="#2D5873" strokeWidth="4" strokeLinecap="round" />
    </g>
  ),

  polo: (
    <g>
      {shadow}
      <path
        d="M66 34l20-10h28l20 10 32 28-17 23-14-11v94H65V74L51 85 34 62z"
        fill="#F7FBFE"
        stroke="#4F7896"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      {/* collar flaps */}
      <path d="M86 24l14 18-18 8-6-20zM114 24l-14 18 18 8 6-20z" fill="#DCEBF5" stroke="#4F7896" strokeWidth="3" strokeLinejoin="round" />
      {/* placket */}
      <path d="M100 42v36" stroke="#4F7896" strokeWidth="3" />
      <circle cx="104" cy="54" r="2.6" fill="#4F7896" />
      <circle cx="104" cy="67" r="2.6" fill="#4F7896" />
      {/* pocket + patch */}
      <rect x="112" y="84" width="20" height="22" rx="3" stroke="#9DB4C6" strokeWidth="2.5" />
      <circle cx="80" cy="92" r="8" fill="#2D5873" />
      <path d="m77 92 2.5 2.5 5-6" stroke="#F5DE57" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {/* sleeve trim */}
      <path d="M43 68l15 12M157 68l-15 12" stroke="#2D5873" strokeWidth="4" strokeLinecap="round" />
    </g>
  ),

  skirt: (
    <g>
      {shadow}
      <rect x="66" y="28" width="68" height="16" rx="5" fill="#1F4A66" stroke="#173A50" strokeWidth="3" />
      <path d="M67 44h66l26 128H41z" fill="#2D5873" stroke="#173A50" strokeWidth="3" strokeLinejoin="round" />
      {/* pleats */}
      <path d="M84 44 74 172M100 44v128M116 44l10 128" stroke="#173A50" strokeWidth="2.5" opacity=".6" />
      <path d="M76 44 58 172M124 44l18 128" stroke="#4E7C9B" strokeWidth="2" opacity=".55" />
      <circle cx="128" cy="36" r="3" fill="#F5DE57" />
    </g>
  ),

  slacks: (
    <g>
      {shadow}
      <path
        d="M62 26h76l8 148h-38l-8-92-8 92H54z"
        fill="#2B3F52"
        stroke="#1C2B39"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <rect x="60" y="22" width="80" height="14" rx="4" fill="#22344A" stroke="#1C2B39" strokeWidth="3" />
      {/* belt loops + button */}
      <path d="M72 22v14M128 22v14" stroke="#5A738B" strokeWidth="3" />
      <circle cx="100" cy="29" r="3" fill="#C9D6E2" />
      {/* creases */}
      <path d="M76 46l-4 122M124 46l4 122" stroke="#4A6178" strokeWidth="2" />
      <path d="M100 36v40" stroke="#1C2B39" strokeWidth="2.5" />
    </g>
  ),

  fabric: (
    <g>
      {shadow}
      {/* folded stack */}
      <rect x="38" y="122" width="124" height="40" rx="9" fill="#2D5873" stroke="#1E405A" strokeWidth="3" />
      <rect x="44" y="90" width="112" height="36" rx="9" fill="#F7FBFE" stroke="#7D9AB0" strokeWidth="3" />
      <rect x="52" y="60" width="96" height="34" rx="9" fill="#86D0B9" stroke="#3E8C6E" strokeWidth="3" />
      {/* fold lines */}
      <path d="M48 142h104M54 108h92M60 77h80" stroke="#FFFFFF" strokeWidth="2.5" opacity=".55" strokeDasharray="6 6" />
      {/* roll on top */}
      <rect x="70" y="30" width="62" height="28" rx="14" fill="#F5DE57" stroke="#B49B2A" strokeWidth="3" />
      <ellipse cx="72" cy="44" rx="7" ry="14" fill="#E9CF4A" stroke="#B49B2A" strokeWidth="3" />
      <circle cx="72" cy="44" r="3" fill="#B49B2A" />
    </g>
  ),

  generic: (
    <g>
      {shadow}
      <path d="M46 66h108l-10 108H56z" fill="#E9B76E" stroke="#835D38" strokeWidth="3" strokeLinejoin="round" />
      <path d="M72 70V54c0-30 56-30 56 0v16" stroke="#835D38" strokeWidth="7" strokeLinecap="round" />
      <path d="M80 104h40M84 120h32" stroke="#FFF1D8" strokeWidth="6" strokeLinecap="round" />
      <circle cx="100" cy="146" r="12" fill="#2E602E" />
      <path d="m95 146 3.5 3.5 6.5-8" stroke="#F5DE57" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  ),
};
