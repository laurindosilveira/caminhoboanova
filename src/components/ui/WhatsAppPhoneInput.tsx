import { forwardRef, useEffect, useRef, useState } from "react";
import { CheckCircle2, AlertCircle, Info } from "lucide-react";
import { formatBRPhone, validateBRPhone, type PhoneValidation } from "@/lib/phoneValidation";

type Props = {
  /** Valor controlado — pode ser número formatado ou dígitos crus */
  value: string;
  onChange: (formatted: string, validation: PhoneValidation) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** Forçar exibição da validação mesmo sem o campo ter sido tocado */
  showValidationAlways?: boolean;
  id?: string;
  name?: string;
};

/**
 * Input de telefone/WhatsApp brasileiro com:
 * - DDI +55 estático (fixo)
 * - Máscara automática: (XX) XXXXX-XXXX
 * - Validação em tempo real com dicas coloridas
 * - DDD validado contra lista ANATEL
 */
const WhatsAppPhoneInput = forwardRef<HTMLInputElement, Props>(
  (
    {
      value,
      onChange,
      placeholder = "(00) 00000-0000",
      disabled = false,
      className = "",
      showValidationAlways = false,
      id,
      name,
    },
    _ref
  ) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const [touched, setTouched] = useState(false);

    // Inicializa formatado
    const [display, setDisplay] = useState(() => formatBRPhone(value));

    // Sincroniza quando value muda externamente (ex: reset do form)
    useEffect(() => {
      const formatted = formatBRPhone(value);
      setDisplay(formatted);
    }, [value]);

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
      const raw = e.target.value;
      // Preserva posição do cursor após formatação
      const cursorBefore = e.target.selectionStart ?? raw.length;

      const formatted = formatBRPhone(raw);
      setDisplay(formatted);

      const validation = validateBRPhone(formatted);
      onChange(formatted, validation);

      // Restaurar cursor aproximadamente (formatação pode deslocar 1-2 chars)
      requestAnimationFrame(() => {
        if (!inputRef.current) return;
        const diff = formatted.length - raw.length;
        const newPos = Math.max(0, cursorBefore + diff);
        inputRef.current.setSelectionRange(newPos, newPos);
      });
    }

    function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
      // Permitir teclas de controle
      const allowed = [
        "Backspace", "Delete", "ArrowLeft", "ArrowRight",
        "ArrowUp", "ArrowDown", "Tab", "Home", "End",
      ];
      if (allowed.includes(e.key)) return;
      // Bloquear se já tem 11 dígitos (15 chars formatados)
      const currentDigits = display.replace(/\D/g, "");
      if (currentDigits.length >= 11 && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
      }
    }

    function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
      e.preventDefault();
      const pasted = e.clipboardData.getData("text");
      const formatted = formatBRPhone(pasted);
      setDisplay(formatted);
      const validation = validateBRPhone(formatted);
      onChange(formatted, validation);
    }

    const validation = validateBRPhone(display);
    const showHint = (touched || showValidationAlways) && display.length > 0;

    const borderColor = !showHint
      ? "border-border focus:border-primary"
      : validation.severity === "ok"
      ? "border-brand-green focus:border-brand-green"
      : validation.severity === "error"
      ? "border-destructive focus:border-destructive"
      : validation.severity === "warning"
      ? "border-yellow-400 focus:border-yellow-400"
      : "border-border focus:border-primary";

    const hintColor =
      validation.severity === "ok"
        ? "text-brand-green"
        : validation.severity === "error"
        ? "text-destructive"
        : "text-yellow-500";

    const HintIcon =
      validation.severity === "ok"
        ? CheckCircle2
        : validation.severity === "error"
        ? AlertCircle
        : Info;

    return (
      <div className="space-y-1">
        {/* Input com DDI estático */}
        <div className={`flex items-center gap-0 rounded-xl border bg-background transition-colors ${borderColor} ${disabled ? "opacity-50" : ""}`}>
          {/* DDI badge */}
          <span className="flex items-center gap-1 px-3 py-2.5 border-r border-border text-sm font-inter font-medium text-muted-foreground select-none whitespace-nowrap bg-muted/40 rounded-l-xl">
            🇧🇷 +55
          </span>

          {/* Input principal */}
          <input
            ref={inputRef}
            id={id}
            name={name}
            type="tel"
            inputMode="numeric"
            value={display}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            onBlur={() => setTouched(true)}
            placeholder={placeholder}
            disabled={disabled}
            autoComplete="tel-national"
            className={`flex-1 min-w-0 bg-transparent px-3 py-2.5 text-sm font-inter text-foreground placeholder:text-muted-foreground/60 focus:outline-none ${className}`}
          />

          {/* Ícone de status inline */}
          {showHint && validation.severity !== "idle" && (
            <span className="pr-3 flex-shrink-0">
              {validation.severity === "ok" ? (
                <CheckCircle2 className="w-4 h-4 text-brand-green" />
              ) : validation.severity === "error" ? (
                <AlertCircle className="w-4 h-4 text-destructive" />
              ) : (
                <Info className="w-4 h-4 text-yellow-500" />
              )}
            </span>
          )}
        </div>

        {/* Dica de validação */}
        {showHint && validation.hint && (
          <div className={`flex items-center gap-1.5 px-1 animate-in fade-in slide-in-from-top-1 duration-200`}>
            <HintIcon className={`w-3 h-3 flex-shrink-0 ${hintColor}`} />
            <p className={`text-[11px] font-inter leading-snug ${hintColor}`}>
              {validation.hint}
            </p>
          </div>
        )}

        {/* Sugestão de correção para erros específicos */}
        {showHint && validation.severity === "error" && display.length > 0 && (
          <div className="mx-1 px-2.5 py-1.5 rounded-lg bg-destructive/8 border border-destructive/20">
            <p className="text-[10px] font-inter text-destructive/80 leading-relaxed">
              {getCorrectionTip(display)}
            </p>
          </div>
        )}
      </div>
    );
  }
);

WhatsAppPhoneInput.displayName = "WhatsAppPhoneInput";
export default WhatsAppPhoneInput;

/** Gera dica de correção contextual baseada no número atual */
function getCorrectionTip(formatted: string): string {
  const digits = formatted.replace(/\D/g, "");

  // Usuário digitou DDI junto (13 dígitos ou mais)
  if (digits.length > 11) {
    return "Não inclua o código do Brasil (+55 ou 0055). O campo já considera o Brasil automaticamente. Digite apenas DDD + número.";
  }

  if (digits.length >= 2) {
    const ddd = parseInt(digits.slice(0, 2), 10);

    // DDD começa com 0 ou 1 (inválido)
    if (ddd < 11) {
      return "O DDD nunca começa com 0. Exemplos: 11 (SP), 21 (RJ), 31 (MG), 47 (SC), 51 (RS), 61 (DF), 71 (BA), 81 (PE), 91 (PA).";
    }

    // DDD fora do conjunto ANATEL — sugere regiões próximas
    const regionExamples = getDDDRegionExamples(ddd);
    if (regionExamples) {
      return `DDD ${ddd} não existe. ${regionExamples}`;
    }

    // 11 dígitos mas sem o 9 obrigatório de celular
    if (digits.length === 11 && digits[2] !== "9") {
      const corrected = `(${digits.slice(0, 2)}) 9${digits.slice(3, 7)}-${digits.slice(7, 11)}`;
      return `Celulares no Brasil têm 9 como primeiro dígito após o DDD. Exemplo correto: ${corrected}`;
    }
  }

  if (digits.length < 10) {
    return "Formato esperado: (DDD) 9XXXX-XXXX para celular (11 dígitos) ou (DDD) XXXX-XXXX para fixo (10 dígitos). Exemplo: (47) 99123-4567";
  }

  return "Verifique o número e tente novamente.";
}

/** Sugere DDDs corretos com base na região aproximada do DDD digitado */
function getDDDRegionExamples(ddd: number): string | null {
  const tens = Math.floor(ddd / 10);
  const examples: Record<number, string> = {
    1: "DDDs de São Paulo: 11, 12, 13, 14, 15, 16, 17, 18, 19.",
    2: "DDDs de RJ/ES: 21, 22, 24 (RJ) e 27, 28 (ES).",
    3: "DDDs de MG: 31, 32, 33, 34, 35, 37, 38.",
    4: "DDDs de PR/SC: 41-46 (PR) e 47, 48, 49 (SC).",
    5: "DDDs de RS: 51, 53, 54, 55.",
    6: "DDDs do Centro-Oeste: 61 (DF), 62/64 (GO), 63 (TO), 65/66 (MT), 67 (MS), 68 (AC), 69 (RO).",
    7: "DDDs da BA/SE: 71, 73, 74, 75, 77 (BA) e 79 (SE).",
    8: "DDDs do Nordeste: 81/87 (PE), 82 (AL), 83 (PB), 84 (RN), 85/88 (CE), 86/89 (PI).",
    9: "DDDs do Norte: 91/93/94 (PA), 92/97 (AM), 95 (RR), 96 (AP), 98/99 (MA).",
  };
  return examples[tens] ?? null;
}
