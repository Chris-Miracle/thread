/**
 * Dominant garment colours from a reference photo, computed in the browser: k-means in CIELAB over pixels, with the
 * background cluster (the one owning the image border) removed, then each cluster named by its nearest fashion colour.
 */

type Rgb = [number, number, number]
type Lab = [number, number, number]

const FASHION_COLOURS: Record<string, Rgb> = {
  'black': [20, 20, 22], 'white': [246, 246, 244], 'cream': [240, 230, 205], 'beige': [215, 195, 165],
  'tan': [195, 155, 110], 'brown': [110, 75, 50], 'grey': [140, 140, 140], 'navy': [30, 40, 80],
  'blue': [50, 100, 190], 'light blue': [160, 200, 230], 'denim': [80, 110, 150], 'green': [50, 140, 70],
  'olive': [110, 115, 60], 'sage': [160, 180, 145], 'red': [200, 40, 40], 'burgundy': [110, 25, 40],
  'pink': [235, 130, 170], 'blush': [235, 190, 190], 'orange': [240, 140, 50], 'rust': [170, 80, 40],
  'yellow': [240, 210, 60], 'mustard': [200, 160, 40], 'purple': [110, 60, 150], 'lavender': [190, 170, 220],
}

const CLUSTERS = 5
const ITERATIONS = 12
const MAX_SAMPLES = 4_096
const MIN_SHARE = 0.12
const BORDER_FRACTION = 0.08
const BACKGROUND_BORDER_SHARE = 0.6
const MAX_COLOURS = 3

function channel(value: number): number {
  const normalized = value / 255
  return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4
}

export function rgbToLab([red, green, blue]: Rgb): Lab {
  const r = channel(red)
  const g = channel(green)
  const b = channel(blue)
  const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047
  const y = r * 0.2126 + g * 0.7152 + b * 0.0722
  const z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883
  const f = (value: number) => value > 0.008856 ? Math.cbrt(value) : 7.787 * value + 16 / 116
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))]
}

function distance(left: Lab, right: Lab): number {
  return (left[0] - right[0]) ** 2 + (left[1] - right[1]) ** 2 + (left[2] - right[2]) ** 2
}

const NAMED_LAB = Object.entries(FASHION_COLOURS).map(([name, rgb]) => ({ name, lab: rgbToLab(rgb) }))

export function nearestColourName(lab: Lab): string {
  return NAMED_LAB.reduce((best, entry) => distance(entry.lab, lab) < distance(best.lab, lab) ? entry : best).name
}

interface Sample {
  lab: Lab
  border: boolean
}

function sample(pixels: ArrayLike<number>, width: number, height: number): Sample[] {
  const step = Math.max(1, Math.floor(Math.sqrt((width * height) / MAX_SAMPLES)))
  const borderX = Math.max(1, Math.round(width * BORDER_FRACTION))
  const borderY = Math.max(1, Math.round(height * BORDER_FRACTION))
  const samples: Sample[] = []
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const offset = (y * width + x) * 4
      if ((pixels[offset + 3] ?? 255) < 128) continue
      samples.push({
        lab: rgbToLab([pixels[offset]!, pixels[offset + 1]!, pixels[offset + 2]!]),
        border: x < borderX || y < borderY || x >= width - borderX || y >= height - borderY,
      })
    }
  }
  return samples
}

/** Deterministic farthest-point seeding, so the same photo always yields the same palette. */
function seedCentroids(samples: readonly Sample[], count: number): Lab[] {
  const mean = samples.reduce<Lab>((sum, item) => [sum[0] + item.lab[0], sum[1] + item.lab[1], sum[2] + item.lab[2]], [0, 0, 0])
    .map(value => value / samples.length) as Lab
  const centroids: Lab[] = []
  let reference = mean
  for (let index = 0; index < count; index += 1) {
    const farthest = samples.reduce((best, item) => {
      const nearest = Math.min(distance(item.lab, reference), ...centroids.map(centroid => distance(item.lab, centroid)))
      return nearest > best.score ? { lab: item.lab, score: nearest } : best
    }, { lab: samples[0]!.lab, score: -1 })
    centroids.push(farthest.lab)
    reference = farthest.lab
  }
  return centroids
}

export function extractPalette(pixels: ArrayLike<number>, width: number, height: number): string[] {
  const samples = sample(pixels, width, height)
  if (samples.length < CLUSTERS) return []
  let centroids = seedCentroids(samples, CLUSTERS)
  let assignment = new Int32Array(samples.length)
  for (let iteration = 0; iteration < ITERATIONS; iteration += 1) {
    assignment = Int32Array.from(samples, item => centroids.reduce((best, centroid, index) =>
      distance(item.lab, centroid) < distance(item.lab, centroids[best]!) ? index : best, 0))
    centroids = centroids.map((centroid, index) => {
      const members = samples.filter((_, sampleIndex) => assignment[sampleIndex] === index)
      if (!members.length) return centroid
      return members.reduce<Lab>((sum, item) => [sum[0] + item.lab[0], sum[1] + item.lab[1], sum[2] + item.lab[2]], [0, 0, 0])
        .map(value => value / members.length) as Lab
    })
  }
  const borderTotal = samples.filter(item => item.border).length
  const clusters = centroids.map((centroid, index) => {
    const members = samples.filter((_, sampleIndex) => assignment[sampleIndex] === index)
    return {
      name: nearestColourName(centroid),
      share: members.length / samples.length,
      borderShare: borderTotal ? members.filter(item => item.border).length / borderTotal : 0,
      interiorShare: members.filter(item => !item.border).length / Math.max(1, samples.length - borderTotal),
    }
  })
  // The studio backdrop owns the border; drop it unless it also dominates the subject.
  const background = clusters.find(cluster => cluster.borderShare >= BACKGROUND_BORDER_SHARE && cluster.interiorShare < 0.5)
  const shares = new Map<string, number>()
  for (const cluster of clusters) {
    if (cluster === background) continue
    shares.set(cluster.name, (shares.get(cluster.name) ?? 0) + cluster.interiorShare)
  }
  return [...shares.entries()]
    .filter(([, share]) => share >= MIN_SHARE)
    .toSorted((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, MAX_COLOURS)
    .map(([name]) => name)
}

/** Browser-only: decodes a data URL and extracts its palette. Returns [] when decoding is unavailable. */
export async function paletteFromDataUrl(dataUrl: string): Promise<string[]> {
  if (typeof document === 'undefined' || typeof createImageBitmap === 'undefined') return []
  try {
    const blob = await (await fetch(dataUrl)).blob()
    const bitmap = await createImageBitmap(blob)
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const context = canvas.getContext('2d')
    if (!context) return []
    context.drawImage(bitmap, 0, 0)
    bitmap.close()
    return extractPalette(context.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height)
  } catch {
    return []
  }
}
