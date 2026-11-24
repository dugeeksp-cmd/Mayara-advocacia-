import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import {
  filterProfessions,
  isBrazilianNationality,
  MARITAL_STATUS_OPTIONS,
} from '../utils/legalFieldOptions';

interface NationalityFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}

export function NationalitySelectField({
  id,
  label,
  value,
  onChange,
  required = true,
}: NationalityFieldProps) {
  const [mode, setMode] = useState<'empty' | 'brasileiro(a)' | 'estrangeiro(a)'>(() => {
    if (!value.trim()) return 'empty';
    return isBrazilianNationality(value) ? 'brasileiro(a)' : 'estrangeiro(a)';
  });

  useEffect(() => {
    if (!value.trim()) {
      if (mode !== 'estrangeiro(a)') setMode('empty');
    } else if (isBrazilianNationality(value)) {
      setMode('brasileiro(a)');
    } else {
      setMode('estrangeiro(a)');
    }
  }, [value]);

  function handleSelectChange(next: string) {
    if (next === '') {
      setMode('empty');
      onChange('');
    } else if (next === 'brasileiro(a)') {
      setMode('brasileiro(a)');
      onChange('brasileiro(a)');
    } else {
      setMode('estrangeiro(a)');
      if (isBrazilianNationality(value)) {
        onChange('');
      }
    }
  }

  return (
    <div className="space-y-2.5">
      <div>
        <label htmlFor={id} className="block text-sm font-semibold text-[#0B1D3A] mb-1.5">
          {label}
        </label>
        <select
          id={id}
          value={mode === 'empty' ? '' : mode}
          onChange={(e) => handleSelectChange(e.target.value)}
          required={required}
          className="w-full min-h-[48px] px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-base text-[#0F172A]"
        >
          <option value="">Selecione...</option>
          <option value="brasileiro(a)">Brasileiro(a)</option>
          <option value="estrangeiro(a)">Estrangeiro(a)</option>
        </select>
      </div>

      {mode === 'estrangeiro(a)' && (
        <div>
          <label
            htmlFor={`${id}-custom`}
            className="block text-xs font-semibold text-[#0B1D3A] mb-1"
          >
            Qual nacionalidade?
          </label>
          <input
            id={`${id}-custom`}
            type="text"
            value={isBrazilianNationality(value) ? '' : value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Ex.: portuguesa, argentina, italiana..."
            required={required}
            className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#B8934A] bg-white text-sm text-[#0F172A]"
          />
        </div>
      )}
    </div>
  );
}

interface MaritalStatusFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}

export function MaritalStatusSelectField({
  id,
  label,
  value,
  onChange,
  required = true,
}: MaritalStatusFieldProps) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-[#0B1D3A] mb-1.5">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="w-full min-h-[48px] px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-base text-[#0F172A]"
      >
        <option value="">Selecione...</option>
        {MARITAL_STATUS_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

interface ProfessionComboboxProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}

export function ProfessionComboboxField({
  id,
  label,
  value,
  onChange,
  required = true,
}: ProfessionComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const filtered = useMemo(() => filterProfessions(value), [value]);

  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  function selectProfession(prof: string) {
    onChange(prof);
    setIsOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <label htmlFor={id} className="block text-sm font-semibold text-[#0B1D3A] mb-1.5">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={isOpen}
          aria-autocomplete="list"
          aria-controls={`${id}-listbox`}
          value={value}
          onFocus={() => setIsOpen(true)}
          onChange={(e) => {
            onChange(e.target.value);
            setIsOpen(true);
          }}
          placeholder="Digite ou selecione sua profissão..."
          required={required}
          className="w-full min-h-[48px] pl-4 pr-11 py-2.5 rounded-xl border border-slate-300 bg-white text-base text-[#0F172A]"
        />
        <button
          type="button"
          aria-label="Abrir lista de profissões"
          onClick={() => {
            setIsOpen((prev) => !prev);
            inputRef.current?.focus();
          }}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 min-h-[40px] min-w-[40px] rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-[#0B1D3A]"
        >
          <ChevronDown
            className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </button>
      </div>

      {isOpen && (
        <ul
          id={`${id}-listbox`}
          role="listbox"
          className="absolute z-40 mt-1.5 w-full max-h-60 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-lg py-1 text-sm"
        >
          {filtered.map((prof) => (
            <li key={prof} role="option" aria-selected={value.toLowerCase() === prof.toLowerCase()}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectProfession(prof.toLowerCase())}
                className="w-full px-4 py-2.5 text-left hover:bg-[#F7F1E3]/60 text-[#0B1D3A] font-medium transition-colors"
              >
                {prof}
              </button>
            </li>
          ))}

          {value.trim() && (
            <li className="border-t border-slate-100 mt-1 pt-1">
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectProfession(value.trim())}
                className="w-full px-4 py-2.5 text-left hover:bg-slate-50 text-[#9A7835] font-semibold"
              >
                Confirmar profissão: &ldquo;{value.trim()}&rdquo;
              </button>
            </li>
          )}

          <li className="border-t border-slate-100 mt-1 pt-1">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange('');
                setIsOpen(false);
                inputRef.current?.focus();
              }}
              className="w-full px-4 py-2.5 text-left hover:bg-slate-50 text-slate-600 text-xs font-semibold"
            >
              Outra profissão (digitar manualmente)
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}
