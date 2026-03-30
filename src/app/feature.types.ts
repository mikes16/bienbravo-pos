import type { ComponentType, ReactNode } from 'react'

export interface FeatureManifest {
  id: string
  label: string
  icon: ComponentType<{ className?: string }>
  path: string
  permission?: string
  order: number
}

export interface FeatureRoute {
  path: string
  element: ReactNode
}
