import library from "./photo-library.json" with { type: "json" };

export interface Photo {
  src: string;
  width: number;
  height: number;
  alt: string;
  preview: string;
  previewLarge: string;
}

export const photoLibrary = library satisfies Record<string, Photo>;
export const photos = Object.values(photoLibrary);
