import React from 'react';
import { Plug } from 'lucide-react';

const IntegrationsTab: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold mb-1">Integrações</h2>
        <p className="text-sm text-gray-500">
          Conecte ferramentas externas e automatize fluxos de trabalho.
        </p>
      </div>

      <div className="bg-glass/50 border border-glass-border rounded-2xl p-8 backdrop-blur-sm flex flex-col items-center justify-center min-h-[300px] text-center">
        <div className="p-4 bg-white/5 rounded-2xl mb-4">
          <Plug className="w-10 h-10 text-gray-500" />
        </div>
        <h3 className="text-lg font-semibold text-gray-300 mb-2">Em breve...</h3>
        <p className="text-sm text-gray-600 max-w-sm">
          Integrações com WhatsApp, CRMs e outras ferramentas estarão disponíveis em breve.
        </p>
      </div>
    </div>
  );
};

export default IntegrationsTab;
