// ============================================================================
// JADIJCB: Client-side Image Compression Utility
// ============================================================================
// Optimized for Moroccan contractors uploading heavy photos (5MB+) taken
// directly from Android smartphones at construction sites. Compresses images
// down to ~200-400KB in pure client-side HTML5 Canvas without network cost.
// ============================================================================

export interface CompressedImageResult {
  file: File;
  previewUrl: string;
  originalSize: number;
  compressedSize: number;
}

export async function compressImage(
  file: File,
  maxWidth = 1400,
  maxHeight = 1400,
  quality = 0.78
): Promise<CompressedImageResult> {
  return new Promise((resolve, reject) => {
    // If SVG or non-image, return as-is
    if (!file.type.startsWith('image/') || file.type.includes('svg')) {
      const previewUrl = URL.createObjectURL(file);
      resolve({
        file,
        previewUrl,
        originalSize: file.size,
        compressedSize: file.size,
      });
      return;
    }

    const reader = new FileReader();
    reader.onerror = (err) => reject(err);

    reader.onload = (e) => {
      const img = new Image();
      img.onerror = (err) => reject(err);

      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          const previewUrl = URL.createObjectURL(file);
          resolve({
            file,
            previewUrl,
            originalSize: file.size,
            compressedSize: file.size,
          });
          return;
        }

        // Draw image on canvas with high quality image smoothing
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to blob
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              const previewUrl = URL.createObjectURL(file);
              resolve({
                file,
                previewUrl,
                originalSize: file.size,
                compressedSize: file.size,
              });
              return;
            }

            const cleanName = file.name.replace(/\.[^/.]+$/, '') + '.jpg';
            const compressedFile = new File([blob], cleanName, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            const previewUrl = URL.createObjectURL(blob);

            resolve({
              file: compressedFile,
              previewUrl,
              originalSize: file.size,
              compressedSize: blob.size,
            });
          },
          'image/jpeg',
          quality
        );
      };

      img.src = e.target?.result as string;
    };

    reader.readAsDataURL(file);
  });
}
