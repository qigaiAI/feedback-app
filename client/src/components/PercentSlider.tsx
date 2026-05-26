interface PercentSliderProps {
  value: number | undefined;
  onChange: (v: number | undefined) => void;
}

export default function PercentSlider({ value, onChange }: PercentSliderProps) {
  const current = value ?? 0;

  return (
    <div className="flex items-center gap-3">
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={current}
        onChange={e => onChange(parseInt(e.target.value))}
        className="flex-1 h-2 bg-gray-200 rounded-full appearance-none cursor-pointer accent-primary-600"
        style={{ minHeight: 44 }}
      />
      <span className="text-sm font-medium w-12 text-right text-gray-700">
        {current}%
      </span>
      {value !== undefined && (
        <button
          type="button"
          onClick={() => onChange(undefined)}
          className="text-xs text-gray-400 hover:text-red-400"
        >
          ✕
        </button>
      )}
    </div>
  );
}
