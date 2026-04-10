/**
 * Valida se um número de WhatsApp está no formato correto
 * Aceita formatos: 5511999999999, +5511999999999, 11999999999
 */
export function validateWhatsAppNumber(number: string): { valid: boolean; error?: string; cleaned?: string } {
  if (!number || !number.trim()) {
    return { valid: false, error: 'Número é obrigatório' };
  }

  // Remove espaços e caracteres especiais (exceto + no início)
  const cleaned = number.trim().replace(/[^\d+]/g, '');
  
  // Remove o + se existir para validação
  const digitsOnly = cleaned.replace(/^\+/, '');
  
  // Validação básica: deve ter pelo menos 10 dígitos e no máximo 15
  if (digitsOnly.length < 10) {
    return { valid: false, error: 'Número muito curto. Use o formato: 5511999999999' };
  }
  
  if (digitsOnly.length > 15) {
    return { valid: false, error: 'Número muito longo. Use o formato: 5511999999999' };
  }
  
  // Verifica se contém apenas dígitos (após remover o +)
  if (!/^\d+$/.test(digitsOnly)) {
    return { valid: false, error: 'Número contém caracteres inválidos' };
  }
  
  return { valid: true, cleaned: digitsOnly };
}

/**
 * Valida se uma URL está no formato correto
 */
export function validateURL(url: string): { valid: boolean; error?: string } {
  if (!url || !url.trim()) {
    return { valid: false, error: 'URL é obrigatória' };
  }

  const trimmed = url.trim();
  
  // Verifica se começa com http:// ou https://
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    return { valid: false, error: 'URL deve começar com http:// ou https://' };
  }
  
  // Validação básica de formato de URL
  try {
    new URL(trimmed);
    return { valid: true };
  } catch {
    return { valid: false, error: 'URL inválida' };
  }
}

/**
 * Formata número de WhatsApp para exibição
 */
export function formatWhatsAppNumber(number: string): string {
  const cleaned = number.replace(/[^\d]/g, '');
  
  if (cleaned.length <= 2) return cleaned;
  if (cleaned.length <= 4) return `${cleaned.slice(0, 2)} ${cleaned.slice(2)}`;
  if (cleaned.length <= 7) return `${cleaned.slice(0, 2)} ${cleaned.slice(2, 4)} ${cleaned.slice(4)}`;
  if (cleaned.length <= 11) return `${cleaned.slice(0, 2)} ${cleaned.slice(2, 7)} ${cleaned.slice(7)}`;
  return `${cleaned.slice(0, 2)} ${cleaned.slice(2, 7)} ${cleaned.slice(7, 11)}-${cleaned.slice(11)}`;
}


