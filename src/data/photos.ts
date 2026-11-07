import rawLibrary from "./photo-library.json" with { type: "json" };

export interface Photo {
  src: string;
  width: number;
  height: number;
  alt: string;
  preview: string;
  previewLarge: string;
}

const source = rawLibrary as Record<string, Photo & { publishedAt?: string }>;
export const photoLibrary: Record<string, Photo> = source;

// Newest upload first. Photos published before timestamps existed keep their
// previous wall order and always follow timestamped uploads.
const ranked = Object.entries(source).map(([id, photo], index) => ({ id, photo, index }));
ranked.sort((a, b) => {
  const left = a.photo.publishedAt;
  const right = b.photo.publishedAt;
  if (left && right) return right.localeCompare(left) || a.index - b.index;
  if (left) return -1;
  if (right) return 1;
  return a.index - b.index;
});
export const photos = ranked.map(({ photo }) => photo);
