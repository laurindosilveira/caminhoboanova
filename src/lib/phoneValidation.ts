/**
 * Validação e formatação de números telefônicos brasileiros
 * Compatível com E.164 para uso no WhatsApp API
 */

/** DDDs válidos no Brasil (ANATEL) */
const VALID_DDDS = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19, // SP
  21, 22, 24,                           // RJ
  27, 28,                               // ES
  31, 32, 33, 34, 35, 37, 38,          // MG
  41, 42, 43, 44, 45, 46,              // PR
  47, 48, 49,                           // SC
  51, 53, 54, 55,                       // RS
  61,                                   // DF
  62, 64,                               // GO
  63,                                   // TO
  65, 66,                               // MT
  67,                                   // MS
  68,                                   // AC
  69,                                   // RO
  71, 73, 74, 75, 77,                  // BA
  79,                                   // SE
  81, 87,                               // PE
  82,                                   // AL
  83,                                   // PB
  84,                                   // RN
  85, 88,                               // CE
  86, 89,                               // PI
  91, 93, 94,                          // PA
  92, 97,                               // AM
  95,                                   // RR
  96,                                   // AP
  98, 99,                               // MA
]);

export type PhoneValidation = {
  /** Número formatado para exibição: (47) 99999-9999 */
  formatted: string;
  /** Dígitos puros sem país: 47999999999 */
  digits: string;
  /** Número em formato E.164: +5547999999999 */
  e164: string | null;
  /** Mensagem de dica para o usuário */
  hint: string;
  /** Estado da validação */
  severity: "idle" | "ok" | "warning" | "error";
  /** Número é válido e pronto para envio */
  valid: boolean;
};

/** Extrai dígitos puros e remove prefixo 55 se digitado pelo usuário */
function extractDigits(raw: string): string {
  const all = raw.replace(/\D/g, "");
  // Remove código do país caso o usuário tenha digitado 55 + mais de 10 dígitos
  if (all.startsWith("55") && all.length > 11) return all.slice(2);
  return all;
}

/** Formata dígitos puros na máscara (XX) XXXXX-XXXX */
export function formatBRPhone(raw: string): string {
  const d = extractDigits(raw);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  // 11 dígitos (celular com 9)
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7, 11)}`;
}

/** Valida e descreve o número com feedback em tempo real */
export function validateBRPhone(raw: string): PhoneValidation {
  const digits = extractDigits(raw);
  const formatted = formatBRPhone(raw);

  if (digits.length === 0) {
    return { formatted, digits, e164: null, hint: "", severity: "idle", valid: false };
  }

  if (digits.length < 2) {
    return {
      formatted, digits, e164: null,
      hint: "Digite o DDD primeiro (2 dígitos) — ex: 47 para SC, 51 para RS, 11 para SP",
      severity: "warning", valid: false,
    };
  }

  const ddd = parseInt(digits.slice(0, 2), 10);

  if (digits.length >= 2 && !VALID_DDDS.has(ddd)) {
    return {
      formatted, digits, e164: null,
      hint: `DDD ${ddd} inválido — ex. válidos: 11 (SP), 21 (RJ), 47 (SC), 51 (RS), 61 (DF), 71 (BA), 85 (CE), 91 (PA)`,
      severity: "error", valid: false,
    };
  }

  if (digits.length < 10) {
    const faltam = (digits.length < 6 ? 10 : digits.length < 7 ? 11 : 11) - digits.length;
    return {
      formatted, digits, e164: null,
      hint: `Falta${faltam > 1 ? "m" : ""} ${faltam} dígito${faltam > 1 ? "s" : ""} — celular completo: (DDD) 9XXXX-XXXX`,
      severity: "warning", valid: false,
    };
  }

  if (digits.length === 10) {
    // Telefone fixo (8 dígitos + DDD)
    return {
      formatted, digits, e164: `+55${digits}`,
      hint: "Telefone fixo válido ✓",
      severity: "ok", valid: true,
    };
  }

  if (digits.length === 11) {
    const ninthDigit = digits[2];
    if (ninthDigit !== "9") {
      return {
        formatted, digits, e164: null,
        hint: `Celular deve iniciar com 9 após o DDD — ex: (${digits.slice(0, 2)}) 9${digits.slice(3, 7)}-${digits.slice(7, 11)}`,
        severity: "error", valid: false,
      };
    }
    return {
      formatted, digits, e164: `+55${digits}`,
      hint: "Celular válido ✓",
      severity: "ok", valid: true,
    };
  }

  // Mais de 11 dígitos — usuário provavelmente digitou o DDI
  return {
    formatted, digits, e164: null,
    hint: "Número muito longo — não inclua o DDI (+55). O campo já considera o Brasil automaticamente.",
    severity: "error", valid: false,
  };
}

/** Converte qualquer formato de número BR para E.164 (retorna null se inválido) */
export function toE164(raw: string): string | null {
  return validateBRPhone(raw).e164;
}

/** Determina a razão de bloqueio de um número inválido para salvar no banco */
export function getBlockedReason(raw: string): string | null {
  const v = validateBRPhone(raw);
  if (v.valid) return null;
  if (!raw || raw.replace(/\D/g, "").length === 0) return "Número não informado";
  return v.hint || "Formato inválido";
}
