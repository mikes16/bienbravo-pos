import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import { ApolloProvider } from '@apollo/client/react'
import { createPosApolloClient } from '@/core/apollo/client.ts'
import { RepositoryProvider } from '@/core/repositories/RepositoryProvider.tsx'
import { createRepositories } from '@/core/repositories/registry.ts'
import { PosAuthProvider } from '@/core/auth/PosAuthProvider.tsx'
import { usePosAuth } from '@/core/auth/usePosAuth.ts'
import { LocationProvider } from '@/core/location/LocationProvider.tsx'
import { ToastProvider } from '@/core/toast/ToastProvider.tsx'
import { BootstrapProvider } from '@/core/bootstrap/BootstrapProvider.tsx'
import { FreshnessProvider } from '@/core/freshness/FreshnessProvider.tsx'
import { useFreshness } from '@/core/freshness/useLiveRefresh.ts'

/**
 * Refresco al DESBLOQUEAR con PIN (spec § 3.3 d).
 *
 * Disparador por ACCIÓN del usuario, nunca por tiempo: el barbero que acaba de
 * meter su PIN jamás ve los datos del anterior. No hay aquí —ni en el
 * provider— ningún temporizador periódico; el esquema sigue siendo "cero
 * sondeo" (D-009).
 *
 * Vive fuera del shell a propósito: mientras el POS está bloqueado `PosShell`
 * está DESMONTADO (la ruta "/" es el lock screen), así que desde ahí nadie
 * podría observar la transición bloqueado → desbloqueado. Tampoco va dentro de
 * `PosAuthProvider`: la sesión no tiene por qué saber que existe la frescura.
 *
 * No pinta nada: es solo el puente entre las dos señales.
 */
export function RefreshOnUnlock() {
  const { isLocked } = usePosAuth()
  const { refreshAll } = useFreshness()
  const wasLocked = useRef(isLocked)

  useEffect(() => {
    const was = wasLocked.current
    wasLocked.current = isLocked
    // SOLO la transición true → false. Montar ya desbloqueado (arranque del
    // POS) no dispara nada: cada pantalla pide su dato al montar.
    if (was && !isLocked) refreshAll()
  }, [isLocked, refreshAll])

  return null
}

/**
 * Canal de frescura para toda la app (un solo juego de suscripciones por
 * sucursal, spec § 3.3 a) — pero solo mientras hay SESIÓN.
 *
 * El gate importa porque la sucursal se resuelve con una query pública
 * (`posPublicLocations`): un POS deslogueado tiene `locationSlug` y, sin este
 * gate, mantendría abiertas las tres suscripciones de la sucursal con una
 * cookie muerta. La otra mitad del gate —sin slug no se abre nada— ya vive
 * dentro del provider.
 *
 * `lock()` conserva el viewer, así que bloquear NO cruza este gate: el canal y
 * el observador de desbloqueo siguen montados mientras el operador está en el
 * lock screen. Solo login y logout lo cruzan, y ahí la app cambia de pantalla
 * completa de todos modos.
 */
function FreshnessGate({ children }: { children: ReactNode }) {
  const { isAuthenticated } = usePosAuth()
  if (!isAuthenticated) return <>{children}</>

  return (
    <FreshnessProvider>
      <RefreshOnUnlock />
      {children}
    </FreshnessProvider>
  )
}

export function Providers({ children }: { children: ReactNode }) {
  const client = useMemo(() => createPosApolloClient(), [])
  const repos = useMemo(() => createRepositories(client), [client])

  return (
    <ApolloProvider client={client}>
      <RepositoryProvider value={repos}>
        <LocationProvider>
          <PosAuthProvider>
            {/* Apollo + sucursal + sesión arriba (los tres los necesita), y
                el router/shell abajo: las suscripciones sobreviven a los
                cambios de pantalla, que es justo el bug que arregla (R8). */}
            <FreshnessGate>
              <BootstrapProvider>
                <ToastProvider>
                  {children}
                </ToastProvider>
              </BootstrapProvider>
            </FreshnessGate>
          </PosAuthProvider>
        </LocationProvider>
      </RepositoryProvider>
    </ApolloProvider>
  )
}
