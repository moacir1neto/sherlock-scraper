import { useState } from 'react';
import { Save } from 'lucide-react';

export default function TabObservacoes() {
  const [notes, setNotes] = useState('');

  return (
    <div className="p-6 flex flex-col h-full">
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Adicione observações sobre este negócio..."
        className="flex-1 w-full min-h-[300px] px-5 py-4 bg-white border border-gray-200 rounded-2xl text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition resize-none leading-relaxed"
      />
      <div className="flex justify-end mt-4">
        <button className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg shadow-blue-600/20 transition-all active:scale-[0.98] text-sm">
          <Save size={16} />
          Salvar
        </button>
      </div>
    </div>
  );
}
