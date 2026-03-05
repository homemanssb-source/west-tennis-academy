interface Step { label: string; icon?: string }

interface ProgressBarProps {
  steps: Step[]
  currentStep: number
}

export default function ProgressBar({ steps, currentStep }: ProgressBarProps) {
  return (
    <div className="flex items-center justify-center px-5 pt-4 pb-2 gap-0">
      {steps.map((step, i) => (
        <div key={i} className="flex flex-col items-center gap-1.5 flex-1 relative">
          {i < steps.length - 1 && (
            <div className={`absolute top-3 left-1/2 w-full h-px transition-colors ${
              i < currentStep ? 'bg-forest/40' : 'bg-forest/10'
            }`} />
          )}
          <div className={`w-6 h-6 rounded-full z-10 flex items-center justify-center text-[10px] font-bold transition-all ${
            i < currentStep
              ? 'bg-forest text-white'
              : i === currentStep
              ? 'bg-lime text-white shadow-[0_0_10px_rgba(61,184,64,.4)]'
              : 'bg-[#EAF3EA] border-[1.5px] border-[#B0CBB0] text-[#7A9A7A]'
          }`}>
            {i < currentStep ? '✓' : step.icon ?? i + 1}
          </div>
          <span className={`text-[9px] whitespace-nowrap tracking-[.5px] ${
            i === currentStep ? 'text-forest font-semibold'
            : i < currentStep ? 'text-[#2A5A2A]'
            : 'text-[#8AAA8A]'
          }`}>
            {step.label}
          </span>
        </div>
      ))}
    </div>
  )
}