import { useState } from 'react';
import { PhoneCall, Mail, Video, MessageCircle, Calendar, Clock } from 'lucide-react';

const activityTypes = [
  { id: 'followup', label: 'Follow-up', icon: MessageCircle, color: 'bg-blue-500' },
  { id: 'call', label: 'Chamada', icon: PhoneCall, color: 'bg-green-500' },
  { id: 'email', label: 'E-mail', icon: Mail, color: 'bg-orange-500' },
  { id: 'meeting', label: 'Reunião', icon: Video, color: 'bg-purple-500' },
];

export default function TabAtividade() {
  const [selectedType, setSelectedType] = useState('followup');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');

  return (
    <div className="p-6 space-y-6">
      {/* Activity Type Selector */}
      <div>
        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 block">
          Tipo de Atividade
        </label>
        <div className="grid grid-cols-4 gap-3">
          {activityTypes.map((type) => {
            const Icon = type.icon;
            const isActive = selectedType === type.id;
            return (
              <button
                key={type.id}
                onClick={() => setSelectedType(type.id)}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                  isActive
                    ? 'border-blue-500 bg-blue-50 shadow-sm'
                    : 'border-gray-100 bg-white hover:border-gray-200'
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center text-white ${type.color}`}
                >
                  <Icon size={18} />
                </div>
                <span
                  className={`text-xs font-semibold ${
                    isActive ? 'text-blue-700' : 'text-gray-500'
                  }`}
                >
                  {type.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Title */}
      <div>
        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">
          Título
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ex: Ligar para confirmar reunião"
          className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition"
        />
      </div>

      {/* Description */}
      <div>
        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">
          Descrição
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Detalhes da atividade..."
          rows={3}
          className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition resize-none"
        />
      </div>

      {/* Date + Time */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">
            <Calendar size={12} className="inline mr-1" />
            Data
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition"
          />
        </div>
        <div>
          <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">
            <Clock size={12} className="inline mr-1" />
            Horário
          </label>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition"
          />
        </div>
      </div>

      {/* Submit */}
      <button className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg shadow-blue-600/20 transition-all active:scale-[0.98]">
        Agendar Atividade
      </button>
    </div>
  );
}
