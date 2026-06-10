import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Fuentes self-hosted (woff2 fingerprinteados por Vite, precargados desde el
// bundle). Reemplazan el <link> render-blocking a fonts.googleapis.com — sin
// RTTs a terceros y sin depender de una CDN externa en cada boot. @fontsource
// setea font-display: swap, así el texto nunca queda invisible esperando la
// fuente. Solo los pesos que el diseño usa (Manrope 400-800, Barlow 800).
import '@fontsource/manrope/latin-400.css'
import '@fontsource/manrope/latin-500.css'
import '@fontsource/manrope/latin-600.css'
import '@fontsource/manrope/latin-700.css'
import '@fontsource/manrope/latin-800.css'
import '@fontsource/barlow-condensed/latin-800.css'
import { App } from '@/app/App.tsx'
import { router } from '@/app/router.tsx'
import { initWebVitals } from '@/core/telemetry/webVitals.ts'
import { attachNavTiming } from '@/core/telemetry/navTiming.ts'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Telemetría fuera del árbol de React para no duplicarse con StrictMode.
// Core Web Vitals (verdad de campo del presupuesto <1s) + latencia por
// navegación in-app. Best-effort: si no hay endpoint configurado, no agrega
// red (solo console.debug en DEV).
initWebVitals()
attachNavTiming(router)
