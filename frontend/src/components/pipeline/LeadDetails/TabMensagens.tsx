import { MessageSquare } from 'lucide-react';

export default function TabMensagens() {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      <div className="w-20 h-20 rounded-3xl bg-gray-100 flex items-center justify-center mb-6">
        <MessageSquare size={36} className="text-gray-300" />
      </div>
      <h3 className="text-lg font-bold text-gray-700 mb-2">
        Contato não encontrado
      </h3>
      <p className="text-sm text-gray-400 max-w-sm leading-relaxed">
        Não encontramos uma conversa associada ao telefone deste lead. Vincule um
        contato para visualizar as mensagens aqui.
      </p>
    </div>
  );
}
