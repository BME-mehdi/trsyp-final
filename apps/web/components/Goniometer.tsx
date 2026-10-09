/**
 * Decorative goniometer: the physiotherapist's knee-angle protractor, used as the product's visual motif.
 * Fixed arm along 0°, moving arm at `angle`, ticks every 10°, labels every 30°. Hidden from screen readers;
 * it never shows patient data.
 */
export function Goniometer({ angle = 110, className = '' }: { angle?: number; className?: string }) {
  const cx = 200, cy = 200, r = 160
  // 0° on the left, 180° on the right, measured over the top.
  const p = (deg: number, radius: number) => [cx - radius * Math.cos((deg * Math.PI) / 180), cy - radius * Math.sin((deg * Math.PI) / 180)] as const
  const [ax, ay] = p(angle, r - 8)
  const [s0x, s0y] = p(0, r)
  const [s1x, s1y] = p(angle, r)
  return (
    <svg viewBox="0 0 400 220" aria-hidden="true" className={className}>
      <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke="currentColor" strokeOpacity="0.3" strokeWidth="2" />
      {Array.from({ length: 19 }, (_, i) => i * 10).map((d) => {
        const [x1, y1] = p(d, r - (d % 30 === 0 ? 16 : 9))
        const [x2, y2] = p(d, r)
        return <line key={d} x1={x1} y1={y1} x2={x2} y2={y2} stroke="currentColor" strokeOpacity={d % 30 === 0 ? 0.9 : 0.5} strokeWidth={d % 30 === 0 ? 2 : 1} />
      })}
      {[30, 60, 90, 120, 150].map((d) => {
        const [x, y] = p(d, r - 34)
        return <text key={d} x={x} y={y} fill="currentColor" fillOpacity="0.85" fontSize="13" textAnchor="middle" dominantBaseline="middle">{d}°</text>
      })}
      <path d={`M ${s0x} ${s0y} A ${r} ${r} 0 0 1 ${s1x} ${s1y}`} fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="round" strokeOpacity="0.95" />
      <line x1={cx} y1={cy} x2={cx - r + 8} y2={cy} stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      <line x1={cx} y1={cy} x2={ax} y2={ay} stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r="8" fill="currentColor" />
    </svg>
  )
}
