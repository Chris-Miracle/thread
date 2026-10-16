const MAX_EDGE = 384
const JPEG_QUALITY = 0.78

function drawScaled(bitmap: ImageBitmap): string {
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bitmap.width * scale))
  canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('This browser cannot prepare the image.')
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', JPEG_QUALITY)
}

/** Shrinks a photo to a small JPEG data URL so it fits browser storage and a Shop `like` search. */
export async function downscaleImage(file: Blob): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Choose an image file.')
  const bitmap = await createImageBitmap(file)
  try {
    return drawScaled(bitmap)
  } finally {
    bitmap.close()
  }
}

/** Same as downscaleImage for an image an agent sent as a data URL. Browser only. */
export async function downscaleDataUrl(dataUrl: string): Promise<string> {
  if (typeof document === 'undefined' || typeof createImageBitmap === 'undefined') {
    throw new Error('Send a reference image under 150 KB; this environment cannot resize images.')
  }
  return downscaleImage(await (await fetch(dataUrl)).blob())
}
