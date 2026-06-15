/**
 * compressImage - Client-side image compression to stay under Vercel's 4.5 MB
 * serverless body-size limit.
 *
 * Resizes the image to maxWidth (default 1600px) and re-encodes as JPEG at the
 * given quality (default 0.8). Images already below 1 MB are returned as-is.
 * Ported from the customer site (src/utils/compressImage.ts).
 */
export function compressImage(file, maxWidth = 1600, quality = 0.8) {
  return new Promise((resolve) => {
    // Small enough already - skip
    if (file.size < 1 * 1024 * 1024) return resolve(file);

    const img = new Image();
    const canvas = document.createElement('canvas');

    img.onload = () => {
      let { width, height } = img;
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(
              new File([blob], file.name.replace(/\.\w+$/, '.jpg'), {
                type: 'image/jpeg',
              })
            );
          } else {
            resolve(file);
          }
        },
        'image/jpeg',
        quality
      );
    };

    img.onerror = () => resolve(file);
    img.src = URL.createObjectURL(file);
  });
}
