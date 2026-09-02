import type { SVGProps } from 'react'

/** Ticket con borde dentado abajo y tres líneas — monocromo, misma familia
 *  visual (512 viewBox, currentColor) que el resto de íconos del nav. */
export function ReceiptIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" {...props}>
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M96 32h320v448l-40-32-40 32-40-32-40 32-40-32-40 32-40-32-40 32zm48 80v32h224v-32zm0 80v32h224v-32zm0 80v32h144v-32z"
      />
    </svg>
  )
}
