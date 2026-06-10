import { onLCP, onINP, onCLS, onTTFB, onFCP, type Metric } from 'web-vitals'
import { bootKind, sendRum } from './rum'

/**
 * Wire de Core Web Vitals → RUM. LCP/INP/CLS son la verdad de campo del
 * presupuesto <1s; FCP/TTFB ayudan a separar "red lenta" de "JS pesado".
 * Cada métrica se etiqueta con la ruta y si el boot fue cold/warm para poder
 * leer el percentil correcto por escenario.
 */
function report(metric: Metric): void {
  sendRum({
    kind: 'web-vital',
    name: metric.name,
    value: metric.value,
    rating: metric.rating,
    route: window.location.pathname,
    boot: bootKind(),
  })
}

let started = false

export function initWebVitals(): void {
  if (started) return
  started = true
  onLCP(report)
  onINP(report)
  onCLS(report)
  onTTFB(report)
  onFCP(report)
}
