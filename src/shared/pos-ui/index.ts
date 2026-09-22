// Foundation v2 components — sub-project #0
export { TouchButton } from './TouchButton.tsx'
export { TileGrid } from './TileGrid.tsx'
export { TileButton } from './TileButton.tsx'
export { MoneyDisplay } from './MoneyDisplay.tsx'
export { EmptyStateV2 } from './EmptyStateV2.tsx'
export { Numpad } from './Numpad.tsx'
export type { NumpadKey } from './Numpad.tsx'
export { PinKeypad } from './PinKeypad.tsx'
export { MoneyInput } from './MoneyInput.tsx'
export { StepBar } from './StepBar.tsx'
export { WizardShell } from './WizardShell.tsx'
export { SuccessSplash } from './SuccessSplash.tsx'
export { StatusBoard } from './StatusBoard'
export { StatusBadge } from './StatusBadge'
export type { StatusTone } from './StatusBadge'
export { ReputationBadge } from './ReputationBadge'
export { PlaceholderPage } from './PlaceholderPage'
export { BottomTabNav, type BottomTabNavTab } from './BottomTabNav'
export * from './icons'

// Foundation v2 components — sub-project #3 (Caja)
export { DenominationCounter } from './DenominationCounter'

// Foundation v2 components — sub-project #6 (Skeleton)
export { SkeletonRow, SkeletonCard, SkeletonText, SkeletonCircle } from './Skeleton'

// Frescura del dinero (spec 2026-09-18 § 3.1b) — única forma de pintar una cifra
// de dinero que viene del servidor: esqueleto/guion mientras no sea la cifra vigente.
export { MoneyValue } from './MoneyValue'
export type { MoneyValueStatus } from './MoneyValue'
