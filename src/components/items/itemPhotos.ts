/*
 * Product photos from the "University Uniform & Apparel Catalog"
 * (Larger Images Edition),
 * with the backgrounds removed (transparent WebP cut-outs).
 * The right photo is picked from the item's name, so inventory items
 * named like the catalog (e.g. "PE Uniform (jogging pants only)" or
 * "University Uniform - Female (Ready to Wear) (skirt only)") get
 * their photo automatically.
 */

import idLace from "../../assets/items/id-lace.webp";
import peUniformSet from "../../assets/items/pe-uniform-set.webp";
import peJoggingPants from "../../assets/items/pe-jogging-pants.webp";
import peAthleticShirt from "../../assets/items/pe-athletic-shirt.webp";
import femaleUniformSet from "../../assets/items/female-uniform-set.webp";
import maleUniformSet from "../../assets/items/male-uniform-set.webp";
import femaleUniformTop from "../../assets/items/female-uniform-top.webp";
import femaleUniformSkirt from "../../assets/items/female-uniform-skirt.webp";
import maleUniformTop from "../../assets/items/male-uniform-top.webp";
import maleUniformSlacks from "../../assets/items/male-uniform-slacks.webp";
import uniformFabricSet from "../../assets/items/uniform-fabric-set.webp";
import maleUniformFabricSet from "../../assets/items/male-uniform-fabric-set.webp";

export function getItemPhoto(itemName: string): string | undefined {
  const name = ` ${itemName.toLowerCase()} `;

  // Check "female" before "male" ("female" contains "male").
  const isFemale = name.includes("female");
  const isMale = !isFemale && /\bmale\b/.test(name);

  const isPE = /\bpe\b|p\.e\.|phys(ical)? ?ed/.test(name);

  if (name.includes("lace") || name.includes("lanyard")) return idLace;

  if (isPE) {
    if (/jogging|pants|jogger|trouser/.test(name)) return peJoggingPants;
    if (/shirt|athletic|t-shirt|tee/.test(name)) return peAthleticShirt;
    return peUniformSet;
  }

  if (name.includes("fabric") || name.includes("cloth")) {
    return isMale ? maleUniformFabricSet : uniformFabricSet;
  }

  if (isFemale) {
    if (name.includes("skirt")) return femaleUniformSkirt;
    if (/\btop\b|blouse|shirt/.test(name)) return femaleUniformTop;
    return femaleUniformSet;
  }

  if (isMale) {
    if (/slacks|pants|trouser/.test(name)) return maleUniformSlacks;
    if (/\btop\b|polo|shirt/.test(name)) return maleUniformTop;
    return maleUniformSet;
  }

  if (name.includes("skirt")) return femaleUniformSkirt;
  if (name.includes("slacks")) return maleUniformSlacks;

  return undefined;
}

/* The fabric sets look oversized next to the clothes, so they are drawn smaller. */
const smallerPhotos = new Set([uniformFabricSet, maleUniformFabricSet]);

export function isSmallerPhoto(source: string | undefined) {
  return Boolean(source && smallerPhotos.has(source));
}

/* Tops and the PE shirt sit a few pixels further right than the rest. */
const nudgedRightPhotos = new Set([maleUniformTop, femaleUniformTop, peAthleticShirt]);

export function isNudgedRightPhoto(source: string | undefined) {
  return Boolean(source && nudgedRightPhotos.has(source));
}

/* The female ready-to-wear set: 2px smaller and 2px further right. */
export function isFemaleSetPhoto(source: string | undefined) {
  return Boolean(source && source === femaleUniformSet);
}

/* The female skirt: 8px smaller. */
export function isSkirtPhoto(source: string | undefined) {
  return Boolean(source && source === femaleUniformSkirt);
}

/* The PE uniform set: 5px larger. */
export function isPeSetPhoto(source: string | undefined) {
  return Boolean(source && source === peUniformSet);
}

/* The male ready-to-wear set: 10px larger than the other photos. */
export function isMaleSetPhoto(source: string | undefined) {
  return Boolean(source && source === maleUniformSet);
}
