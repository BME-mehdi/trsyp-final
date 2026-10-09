import { Atkinson_Hyperlegible } from 'next/font/google'
import type { ReactNode } from 'react'
import './globals.css'

export const metadata = { title: 'SymbioMed clinician (research prototype)' }

// Atkinson Hyperlegible (Braille Institute, designed for low-vision readers), self-hosted by next/font at build time.
const atkinson = Atkinson_Hyperlegible({ weight: ['400', '700'], subsets: ['latin', 'latin-ext'], display: 'swap', variable: '--font-atkinson' })

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={atkinson.variable}>
      <body className="min-h-screen font-sans">
        <aside aria-label="Research prototype notice" className="border-b-2 border-ink bg-surface px-4 py-2 text-center font-semibold">
          Research prototype. Not a medical device. Stimulation into a dummy load only.
        </aside>
        {children}
      </body>
    </html>
  )
}
