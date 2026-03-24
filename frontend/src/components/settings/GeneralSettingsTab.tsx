import React from 'react';
import { User } from 'lucide-react';

const GeneralSettingsTab: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold mb-1">Perfil Geral</h2>
        <p className="text-sm text-gray-500">
          Gerencie as informações gerais do seu perfil e conta.
        </p>
      </div>

      <div className="bg-glass/50 border border-glass-border rounded-2xl p-8 backdrop-blur-sm flex flex-col items-center justify-center min-h-[300px] text-center">
        <div className="p-4 bg-white/5 rounded-2xl mb-4">
          <User className="w-10 h-10 text-gray-500" />
        </div>
        <h3 className="text-lg font-semibold text-gray-300 mb-2">Em breve...</h3>
        <p className="text-sm text-gray-600 max-w-sm">
          As configurações de perfil geral estarão disponíveis em uma atualização futura.
        </p>
      </div>
    </div>
  );
};

export default GeneralSettingsTab;
