import { useEffect, useState } from "react";
import ItemArt from "./ItemArt";
import { getItemPhoto, isShiftedLeftPhoto } from "./itemPhotos";

/**
 * Picks the best picture for an item, in this order:
 *   1. an uploaded photo URL saved on the item (e.g. from Aiven)
 *   2. the matching cut-out photo from the uniform & apparel catalog
 *   3. a built-in illustration
 * If a photo fails to load, the next option is used automatically.
 */
export default function ItemImage({
  itemName,
  imageUrl,
  className,
}: {
  itemName: string;
  imageUrl?: string;
  className?: string;
}) {
  const catalogPhoto = getItemPhoto(itemName);

  const sources = [imageUrl, catalogPhoto].filter(
    (source): source is string => Boolean(source)
  );

  const [failedCount, setFailedCount] = useState(0);

  useEffect(() => {
    setFailedCount(0);
  }, [imageUrl, catalogPhoto]);

  const source = sources[failedCount];

  // Catalog pictures are transparent cut-outs; uploaded photos are
  // ordinary rectangular photos, so they are styled differently.
  const kindClass =
    source && source === catalogPhoto ? "is-cutout" : "is-photo";

  const shiftClass = isShiftedLeftPhoto(source) ? " is-shift-left" : "";

  if (source) {
    return (
      <img
        className={`${className ?? ""} ${kindClass}${shiftClass}`.trim()}
        src={source}
        alt={itemName}
        loading="lazy"
        decoding="async"
        onError={() => setFailedCount((count) => count + 1)}
      />
    );
  }

  return <ItemArt itemName={itemName} className={className} />;
}
