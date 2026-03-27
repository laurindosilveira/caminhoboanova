import { useState, useRef, useCallback, useEffect } from "react";
import { Keyboard, RotateCcw, Play, Pause, Zap, Flame, Crown, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

type Difficulty = "facil" | "medio" | "dificil";

interface DifficultyConfig {
  label: string;
  emoji: string;
  icon: typeof Zap;
  color: string;
  bgColor: string;
  timeLimit: number | null; // seconds, null = unlimited
  description: string;
  texts: string[];
}

const DIFFICULTIES: Record<Difficulty, DifficultyConfig> = {
  facil: {
    label: "Fácil",
    emoji: "🌱",
    icon: Zap,
    color: "text-brand-green",
    bgColor: "bg-brand-green/10 border-brand-green/30",
    timeLimit: null,
    description: "Textos curtos, sem limite de tempo",
    texts: [
      "Deus é amor.",
      "Tudo posso naquele que me fortalece.",
      "O Senhor é o meu pastor e nada me faltará.",
      "Sede fortes e corajosos. Não temais.",
      "A fé é a certeza das coisas que se esperam.",
    ],
  },
  medio: {
    label: "Médio",
    emoji: "⚡",
    icon: Flame,
    color: "text-warning",
    bgColor: "bg-warning/10 border-warning/30",
    timeLimit: 60,
    description: "Textos médios, 60 segundos de limite",
    texts: [
      "Porque Deus tanto amou o mundo que deu o seu Filho Unigênito para que todo o que nele crer não pereça mas tenha a vida eterna.",
      "O Senhor é o meu pastor e nada me faltará. Deitar-me faz em verdes pastos e guia-me mansamente a águas tranquilas.",
      "Confie no Senhor de todo o seu coração e não se apoie em seu próprio entendimento. Reconheça o Senhor em todos os seus caminhos.",
      "Pois eu sei muito bem os planos que tenho para vocês, planos de fazê-los prosperar e não de causar dano, planos de dar a vocês esperança e um futuro.",
    ],
  },
  dificil: {
    label: "Difícil",
    emoji: "🔥",
    icon: Crown,
    color: "text-destructive",
    bgColor: "bg-destructive/10 border-destructive/30",
    timeLimit: 45,
    description: "Textos longos, 45 segundos de limite",
    texts: [
      "Porque Deus tanto amou o mundo que deu o seu Filho Unigênito para que todo o que nele crer não pereça mas tenha a vida eterna. Pois Deus enviou o seu Filho ao mundo, não para condenar o mundo, mas para que este fosse salvo por meio dele.",
      "Quem habita no abrigo do Altíssimo e descansa à sombra do Todo-Poderoso pode dizer ao Senhor: Tu és o meu refúgio e a minha fortaleza, o meu Deus, em quem confio. Ele o livrará do laço do caçador e do veneno mortal.",
      "Ainda que eu andasse pelo vale da sombra da morte, não temeria mal algum, porque tu estás comigo; a tua vara e o teu cajado me consolam. Preparas uma mesa perante mim na presença dos meus inimigos. Unges a minha cabeça com óleo e o meu cálice transborda.",
    ],
  },
};

export default function TypingMetricsPanel() {
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [sampleText, setSampleText] = useState("");
  const [typedText, setTypedText] = useState("");
  const [startTime, setStartTime] = useState<number | null>(null);
  const [wpm, setWpm] = useState(0);
  const [accuracy, setAccuracy] = useState(100);
  const [errorCount, setErrorCount] = useState(0);
  const [finished, setFinished] = useState(false);
  const [timeUp, setTimeUp] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function startTest(diff: Difficulty) {
    const config = DIFFICULTIES[diff];
    const text = config.texts[Math.floor(Math.random() * config.texts.length)];
    setDifficulty(diff);
    setSampleText(text);
    setTypedText("");
    setStartTime(null);
    setWpm(0);
    setAccuracy(100);
    setErrorCount(0);
    setFinished(false);
    setTimeUp(false);
    setElapsedSeconds(0);
    setIsActive(true);
    setTimeout(() => inputRef.current?.focus(), 100);
  }

  function resetTest() {
    if (timerRef.current) clearInterval(timerRef.current);
    setIsActive(false);
    setFinished(false);
    setTimeUp(false);
    setTypedText("");
    setStartTime(null);
    setDifficulty(null);
    setWpm(0);
    setAccuracy(100);
    setErrorCount(0);
    setElapsedSeconds(0);
  }

  useEffect(() => {
    if (startTime && !finished && !timeUp) {
      timerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        setElapsedSeconds(elapsed);
        // Check time limit
        const config = difficulty ? DIFFICULTIES[difficulty] : null;
        if (config?.timeLimit && elapsed >= config.timeLimit) {
          setTimeUp(true);
          setFinished(true);
          if (timerRef.current) clearInterval(timerRef.current);
        }
      }, 500);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [startTime, finished, timeUp, difficulty]);

  function handleInput(value: string) {
    if (finished || timeUp) return;
    if (!startTime) setStartTime(Date.now());

    setTypedText(value);

    let errors = 0;
    for (let i = 0; i < value.length; i++) {
      if (value[i] !== sampleText[i]) errors++;
    }
    setErrorCount(errors);

    const totalChars = value.length;
    const correctChars = totalChars - errors;
    const acc = totalChars > 0 ? Math.round((correctChars / totalChars) * 100) : 100;
    setAccuracy(acc);

    const elapsed = (Date.now() - (startTime || Date.now())) / 1000 / 60;
    const words = correctChars / 5;
    setWpm(elapsed > 0 ? Math.round(words / elapsed) : 0);

    if (value.length >= sampleText.length) {
      setFinished(true);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }

  function getCharClass(index: number) {
    if (index >= typedText.length) return "text-muted-foreground";
    return typedText[index] === sampleText[index]
      ? "text-brand-green"
      : "text-destructive bg-destructive/10 rounded";
  }

  const config = difficulty ? DIFFICULTIES[difficulty] : null;
  const timeLimit = config?.timeLimit;
  const remainingTime = timeLimit ? Math.max(0, timeLimit - elapsedSeconds) : null;
  const wpmColor = wpm >= 60 ? "text-brand-green" : wpm >= 30 ? "text-warning" : "text-primary";
  const accColor = accuracy >= 95 ? "text-brand-green" : accuracy >= 80 ? "text-warning" : "text-destructive";

  return (
    <div className="mx-5 mt-4">
      <div className="flex items-center gap-2 mb-3">
        <Keyboard className="w-4 h-4 text-primary" />
        <span className="font-montserrat font-bold text-foreground text-sm">Treino de Digitação</span>
      </div>

      <div className="bg-card border border-border rounded-2xl p-4 shadow-sm space-y-4">
        {!isActive ? (
          <div className="space-y-4">
            <div className="text-center">
              <p className="text-3xl mb-1">⌨️</p>
              <p className="text-sm font-inter text-muted-foreground">
                Escolha o nível de dificuldade
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(DIFFICULTIES) as Difficulty[]).map((diff) => {
                const cfg = DIFFICULTIES[diff];
                const Icon = cfg.icon;
                return (
                  <button
                    key={diff}
                    onClick={() => startTest(diff)}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all hover:scale-[1.03] active:scale-95 ${cfg.bgColor}`}
                  >
                    <Icon className={`w-5 h-5 ${cfg.color}`} />
                    <span className={`font-montserrat font-bold text-xs ${cfg.color}`}>{cfg.label}</span>
                    <span className="text-[9px] text-muted-foreground font-inter text-center leading-tight">
                      {cfg.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <>
            {/* Difficulty badge + timer */}
            <div className="flex items-center justify-between">
              <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-montserrat font-bold ${config?.bgColor} ${config?.color} border`}>
                {config?.emoji} {config?.label}
              </span>
              {remainingTime !== null && (
                <span className={`font-montserrat font-bold text-sm ${remainingTime <= 10 ? "text-destructive animate-pulse" : "text-foreground"}`}>
                  ⏱ {remainingTime}s
                </span>
              )}
            </div>

            {/* Metrics bar */}
            <div className="grid grid-cols-4 gap-2">
              <div className="bg-muted rounded-xl p-2 text-center">
                <p className={`text-lg font-montserrat font-black ${wpmColor}`}>{wpm}</p>
                <p className="text-[9px] text-muted-foreground font-inter uppercase">PPM</p>
              </div>
              <div className="bg-muted rounded-xl p-2 text-center">
                <p className={`text-lg font-montserrat font-black ${accColor}`}>{accuracy}%</p>
                <p className="text-[9px] text-muted-foreground font-inter uppercase">Precisão</p>
              </div>
              <div className="bg-muted rounded-xl p-2 text-center">
                <p className="text-lg font-montserrat font-black text-destructive">{errorCount}</p>
                <p className="text-[9px] text-muted-foreground font-inter uppercase">Erros</p>
              </div>
              <div className="bg-muted rounded-xl p-2 text-center">
                <p className="text-lg font-montserrat font-black text-foreground">{elapsedSeconds}s</p>
                <p className="text-[9px] text-muted-foreground font-inter uppercase">Tempo</p>
              </div>
            </div>

            {/* Progress bar */}
            <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${Math.min((typedText.length / sampleText.length) * 100, 100)}%` }}
              />
            </div>

            {/* Sample text */}
            <div className="bg-muted/50 rounded-xl p-3 font-inter text-sm leading-relaxed select-none">
              {sampleText.split("").map((char, i) => (
                <span key={i} className={`${getCharClass(i)} ${i === typedText.length ? "border-b-2 border-primary" : ""}`}>
                  {char}
                </span>
              ))}
            </div>

            {/* Input */}
            <textarea
              ref={inputRef}
              value={typedText}
              onChange={(e) => handleInput(e.target.value)}
              disabled={finished}
              placeholder="Comece a digitar aqui..."
              className="w-full bg-background border border-border rounded-xl p-3 text-sm font-inter resize-none h-20 focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
            />

            {/* Result / Actions */}
            {finished ? (
              <div className="text-center space-y-2">
                <p className="text-2xl">
                  {timeUp ? "⏰" : accuracy >= 95 && wpm >= 40 ? "🏆" : accuracy >= 80 ? "👏" : "💪"}
                </p>
                <p className="font-montserrat font-bold text-foreground text-sm">
                  {timeUp
                    ? "Tempo esgotado! Tente novamente."
                    : accuracy >= 95 && wpm >= 40
                      ? "Excelente! Ótima velocidade e precisão!"
                      : accuracy >= 80
                        ? "Bom trabalho! Continue praticando."
                        : "Continue treinando para melhorar!"}
                </p>
                <div className="flex gap-2 justify-center">
                  <Button onClick={() => startTest(difficulty!)} variant="outline" className="rounded-xl gap-2 text-xs">
                    <RotateCcw className="w-3.5 h-3.5" /> Repetir
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" className="rounded-xl gap-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10">
                        <AlertTriangle className="w-3.5 h-3.5" /> Trocar Nível
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="rounded-2xl max-w-xs">
                      <AlertDialogHeader>
                        <div className="mx-auto w-12 h-12 rounded-full bg-warning/10 flex items-center justify-center mb-1">
                          <AlertTriangle className="w-6 h-6 text-warning" />
                        </div>
                        <AlertDialogTitle className="text-center font-montserrat font-bold text-base">
                          Resetar progresso?
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-center font-inter text-sm">
                          Seu resultado atual será descartado ao trocar de nível.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter className="flex-row gap-2 sm:flex-row">
                        <AlertDialogCancel className="flex-1 rounded-xl font-montserrat font-bold text-xs">Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={resetTest} className="flex-1 rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90 font-montserrat font-bold text-xs gap-1">
                          <RotateCcw className="w-3.5 h-3.5" /> Trocar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ) : (
              <div className="flex justify-end">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="gap-1 text-xs text-destructive hover:text-destructive hover:bg-destructive/10">
                      <AlertTriangle className="w-3 h-3" /> Cancelar teste
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="rounded-2xl max-w-xs">
                    <AlertDialogHeader>
                      <div className="mx-auto w-12 h-12 rounded-full bg-warning/10 flex items-center justify-center mb-1">
                        <AlertTriangle className="w-6 h-6 text-warning" />
                      </div>
                      <AlertDialogTitle className="text-center font-montserrat font-bold text-base">
                        Cancelar teste?
                      </AlertDialogTitle>
                      <AlertDialogDescription className="text-center font-inter text-sm">
                        Todo o progresso deste teste será perdido.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="flex-row gap-2 sm:flex-row">
                      <AlertDialogCancel className="flex-1 rounded-xl font-montserrat font-bold text-xs">Continuar</AlertDialogCancel>
                      <AlertDialogAction onClick={resetTest} className="flex-1 rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90 font-montserrat font-bold text-xs gap-1">
                        <Pause className="w-3 h-3" /> Sim, cancelar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
