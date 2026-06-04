/**
 * Helper para insertar transformaciones en URLs de Cloudinary. Nos evita
 * descargar fotos de barberos / productos a tamaño completo cuando solo
 * las renderizamos como avatar 40×40 o tile 120×120.
 *
 * Cloudinary URL canónica:
 *   https://res.cloudinary.com/<cloud>/image/upload/<transforms>/<publicId>.<ext>
 *
 * `cldThumb` parsea esa URL, inserta `c_fill,w_,h_,q_auto,f_auto` (o lo
 * que pidas) en la sección de transforms y devuelve la URL nueva. Si la
 * URL no parece de Cloudinary, la devuelve sin tocar (resiliente).
 */

export interface CldThumbOpts {
  /** Ancho en píxeles del slot donde la imagen se va a renderizar. */
  w: number
  /** Alto opcional — si no se da, Cloudinary preserva aspect ratio. */
  h?: number
  /** Calidad — 'auto' deja que Cloudinary elija (recomendado). */
  q?: 'auto' | number
  /** Formato — 'auto' negocia AVIF/WebP/JPEG según el browser (recomendado). */
  f?: 'auto' | 'webp' | 'jpg' | 'png'
  /** Crop strategy — 'fill' = recorta para llenar, 'fit' = escala dentro. */
  c?: 'fill' | 'fit' | 'limit' | 'thumb'
  /** Factor para Retina / hi-dpi. 2 = 2x. Cloudinary genera la resolución
   *  correcta sin pedirle a la app que duplique pixels manualmente. */
  dpr?: number | 'auto'
}

const CLOUDINARY_HOST = 'res.cloudinary.com'
const UPLOAD_MARKER = '/image/upload/'

function buildTransformString(opts: CldThumbOpts): string {
  const parts: string[] = []
  parts.push(`c_${opts.c ?? 'fill'}`)
  parts.push(`w_${Math.round(opts.w)}`)
  if (opts.h != null) parts.push(`h_${Math.round(opts.h)}`)
  parts.push(`q_${opts.q ?? 'auto'}`)
  parts.push(`f_${opts.f ?? 'auto'}`)
  if (opts.dpr != null) parts.push(`dpr_${opts.dpr}`)
  return parts.join(',')
}

/**
 * Devuelve la URL Cloudinary transformada. URLs no-Cloudinary pasan tal cual.
 * URLs Cloudinary que YA tienen transforms — los preserva y agrega el nuestro
 * como un segmento adicional (Cloudinary los aplica en orden).
 */
export function cldThumb(url: string | null | undefined, opts: CldThumbOpts): string | null {
  if (!url) return null
  if (!url.includes(CLOUDINARY_HOST) || !url.includes(UPLOAD_MARKER)) {
    return url
  }
  const [head, tail] = url.split(UPLOAD_MARKER) as [string, string]
  const transform = buildTransformString(opts)
  return `${head}${UPLOAD_MARKER}${transform}/${tail}`
}
