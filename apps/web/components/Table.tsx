import type { ReactNode } from 'react'

/** Dense, readable table with a visible title and real header cells. */
export function Table({ caption, head, rows, empty }: { caption: string; head: string[]; rows: ReactNode[][]; empty: string }) {
  if (rows.length === 0) return <p className="mt-4">{empty}</p>
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full border-collapse text-left">
        <caption className="sr-only">{caption}</caption>
        <thead className="border-b-2 border-divider">
          <tr>{head.map((h) => <th key={h} scope="col" className="px-2 py-2 font-semibold whitespace-nowrap">{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((cells, i) => (
            <tr key={i} className="border-b border-divider">
              {cells.map((c, j) => <td key={j} className="px-2 py-1.5">{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
