/* Picks a built-in illustration (and background tint) from an item name. */

export type ItemArtKind =
  | "lace"
  | "peShirt"
  | "pePants"
  | "blouse"
  | "polo"
  | "skirt"
  | "slacks"
  | "fabric"
  | "generic";

export function getItemArtKind(itemName: string): ItemArtKind {
  const name = ` ${itemName.toLowerCase()} `;
  const isPE = /\bpe\b|p\.e\.|physical education/.test(name);

  if (name.includes("lace") || name.includes("lanyard")) return "lace";

  if (isPE) {
    if (/pants|jogging|jogger|short|trouser/.test(name)) return "pePants";
    return "peShirt";
  }

  if (name.includes("fabric") || name.includes("cloth")) return "fabric";
  if (name.includes("blouse")) return "blouse";
  if (name.includes("skirt")) return "skirt";
  if (/pants|slacks|trouser/.test(name)) return "slacks";
  if (/polo|shirt/.test(name)) return "polo";
  if (name.includes("female")) return "blouse";
  if (name.includes("male")) return "polo";

  return "generic";
}

/** Soft background tint that suits each illustration. */
export function getItemTone(kind: ItemArtKind): "mint" | "sky" | "sand" {
  if (kind === "lace" || kind === "fabric" || kind === "generic") {
    return "sand";
  }

  if (kind === "peShirt" || kind === "pePants") return "mint";

  return "sky";
}

export type ItemCardTone = "mint" | "sky" | "sand";

/** Colour of an item's card, from its name. */
export function getItemCardTone(itemName: string): ItemCardTone {
  const name = itemName.toLowerCase();

  if (name.includes("lace") || name.includes("lanyard")) return "sky";
  if (name.includes("fabric")) return "sky";

  return getItemTone(getItemArtKind(itemName));
}
