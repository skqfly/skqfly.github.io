import library from "./photo-library.json" with { type: "json" };

export interface Photo {
  src: string;
  width: number;
  height: number;
  alt: string;
  preview: string;
  previewLarge: string;
  publishedAt?: string;
}

export const photoLibrary = library satisfies Record<string, Photo>;

// Newest upload first. Photos published before timestamps existed keep their
// previous wall order and always follow timestamped uploads.
const ranked = Object.values(photoLibrary).map((photo, index) => ({ photo, index }));
ranked.sort((a, b) => {
  if (a.photo.publishedAt && b.photo.publishedAt) {
    return b.photo.publishedAt.localeCompare(a.photo.publishedAt) || a.index - b.index;
  }
  if (a.photo.publishedAt) return -1;
  if (b.photo.publishedAt) return 1;
  return a.index - b.index;
});
export const photos = ranked.map(({ photo }) => photo);
