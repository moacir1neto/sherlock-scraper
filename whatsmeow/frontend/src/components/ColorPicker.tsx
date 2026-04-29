import { useState } from 'react';
import { HexColorPicker, HexColorInput } from 'react-colorful';

interface ColorPickerProps {
  label?: string;
  value: string;
  onChange: (color: string) => void;
  id?: string;
}

const PRESETS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1',
  '#14B8A6', '#A855F7', '#E11D48', '#0EA5E9', '#22C55E',
];

export function ColorPicker({ label = 'Cor (opcional)', value, onChange, id }: ColorPickerProps) {
  const [open, setOpen] = useState(false);
  const hex = value && /^#[0-9A-Fa-f]{6}$/.test(value) ? value : '#3B82F6';

  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {label}
        </label>
      )}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          id={id}
          onClick={() => setOpen((v) => !v)}
          className="w-10 h-10 rounded-lg border-2 border-gray-300 dark:border-gray-600 shrink-0 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          style={{ backgroundColor: hex }}
          aria-label="Selecionar cor"
        />
        <HexColorInput
          color={hex}
          onChange={onChange}
          prefixed
          className="flex-1 min-w-[100px] max-w-[120px] px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm font-mono focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
      </div>
      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="relative z-50 mt-2 p-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-lg">
            <HexColorPicker color={hex} onChange={onChange} style={{ width: '100%', height: 160 }} />
            <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
              {PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => { onChange(c); setOpen(false); }}
                  className="w-6 h-6 rounded border border-gray-300 dark:border-gray-600 hover:scale-110 transition-transform"
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
