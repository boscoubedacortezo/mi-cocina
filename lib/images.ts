const MAX_SIDE = 1600;
const QUALITY = 0.82;
const MAX_ORIGINAL_BYTES = 10 * 1024 * 1024;

/**
 * Downsizes a photo in the browser before upload. Falls back to the original
 * file when the browser cannot decode it (e.g. HEIC outside Safari).
 */
export async function prepareImage(
  file: File,
): Promise<{ blob: Blob; ext: string }> {
  try {
    const bitmap = await createImageBitmap(file, {
      imageOrientation: "from-image",
    });
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", QUALITY),
    );
    if (blob) return { blob, ext: "jpg" };
  } catch {
    // fall through to the original file
  }

  const ext = file.type.split("/")[1]?.replace("jpeg", "jpg");
  if (!ext || file.size > MAX_ORIGINAL_BYTES) {
    throw new Error("No se pudo procesar la imagen. Prueba con otra foto.");
  }
  return { blob: file, ext };
}
