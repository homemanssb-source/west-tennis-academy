interface ProgressBarProps {
  value: number
  max: number
  className?: string
}

export default function ProgressBar({ value, max, className = '' }: ProgressBarProps) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  return (
    <div className={`h-2 bg-[#EAF3EA] rounded-full overflow-hidden ${className}`}>
      <div className="h-full bg-[#1B4D2E] rounded-full transition-all duration-500"
        style={{ width: `${pct}%` }} />
    </div>
  )
}
