import { Minus, Plus, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import { clampPx } from '../utils/timbradoTheme';

interface PixelSizeSliderProps {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  defaultValue: number;
  buttonStep?: number;
  variant?: 'font' | 'zoom';
  onChange: (nextPx: number) => void;
  showReset?: boolean;
  helperText?: string;
}

export function PixelSizeSlider({
  id,
  label,
  value,
  min,
  max,
  defaultValue,
  buttonStep = 1,
  variant = 'font',
  onChange,
  showReset = false,
  helperText,
}: PixelSizeSliderProps) {
  const safeValue = clampPx(value, min, max, defaultValue);
  const DecreaseIcon = variant === 'zoom' ? ZoomOut : Minus;
  const IncreaseIcon = variant === 'zoom' ? ZoomIn : Plus;

  function stepBy(delta: number) {
    onChange(clampPx(safeValue + delta, min, max, defaultValue));
  }

  return (
    <div className="p-3.5 rounded-xl bg-[#F7F8FA] border border-slate-200 space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label htmlFor={id} className="text-sm font-semibold text-[#0B1D3A]">
          {label}
        </label>
        <div className="flex items-center gap-2">
          {showReset && safeValue !== defaultValue && (
            <button
              type="button"
              onClick={() => onChange(defaultValue)}
              className="min-h-[30px] px-2.5 py-1 rounded-lg border border-slate-300 bg-white text-[11px] font-semibold text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" aria-hidden="true" />
              Restaurar padrão
            </button>
          )}
          <span
            data-testid={`${id}-value`}
            className="min-w-[54px] text-center px-2.5 py-1 rounded-lg bg-white border border-slate-300 font-mono text-xs sm:text-sm font-bold text-[#0B1D3A] tabular-nums"
          >
            {safeValue}px
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        <button
          type="button"
          aria-label={
            variant === 'zoom'
              ? `Diminuir ${label} em ${buttonStep}px`
              : `Diminuir ${label} em ${buttonStep}px`
          }
          disabled={safeValue <= min}
          onClick={() => stepBy(-buttonStep)}
          className="min-h-[40px] min-w-[40px] rounded-xl border border-slate-300 bg-white text-[#0B1D3A] hover:bg-slate-100 disabled:opacity-40 inline-flex items-center justify-center shrink-0 transition-colors"
        >
          <DecreaseIcon className="w-4 h-4" aria-hidden="true" />
        </button>

        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={1}
          value={safeValue}
          onChange={(e) => onChange(clampPx(Number(e.target.value), min, max, defaultValue))}
          className="w-full h-2 accent-[#0B1D3A] cursor-pointer"
        />

        <button
          type="button"
          aria-label={`Aumentar ${label} em ${buttonStep}px`}
          disabled={safeValue >= max}
          onClick={() => stepBy(buttonStep)}
          className="min-h-[40px] min-w-[40px] rounded-xl border border-slate-300 bg-white text-[#0B1D3A] hover:bg-slate-100 disabled:opacity-40 inline-flex items-center justify-center shrink-0 transition-colors"
        >
          <IncreaseIcon className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      {helperText && <p className="text-[11px] text-slate-500">{helperText}</p>}
    </div>
  );
}
