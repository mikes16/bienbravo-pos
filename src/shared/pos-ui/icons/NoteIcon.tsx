import type { SVGProps } from 'react'

/**
 * Nota / recado — hoja con esquina doblada y renglones. Marca la nota interna de
 * la cita (staffNote) en la fila del Hoy y en el aviso del checkout. Trazo (no
 * relleno) para leerse limpio a tamaños chicos (12–16px) dentro del lenguaje
 * editorial sharp del POS. Hereda el color vía `currentColor`.
 */
export function NoteIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M4 3.5h16v11l-5.5 5.5H4z" />
      <path d="M14.5 20v-5.5H20" />
      <path d="M8 8.5h8M8 12h5" />
    </svg>
  )
}
