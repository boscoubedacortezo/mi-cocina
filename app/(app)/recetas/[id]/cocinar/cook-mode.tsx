"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  BellOff,
  Check,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  RotateCcw,
  ShoppingBasket,
  Timer,
  Volume2,
  X,
} from "lucide-react";
import { ThermomixIcon } from "@/components/equipment-icons";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { beepDataUrl, CHIME_NOTES, unlockDataUrl } from "@/lib/beep";
import { useWakeLock } from "@/lib/use-wake-lock";
import { findStepTimers, formatClock } from "@/lib/recipes/step-timers";
import { cn } from "@/lib/utils";

type Way = { ingredients: string[]; steps: { text: string; settings: string[] }[] };

type RunningTimer = {
  id: string;
  label: string;
  total: number;
  /** Seconds left while paused; the end moment while running. */
  left: number;
  endsAt: number | null;
  done: boolean;
};

/**
 * A soft chime and a short vibration. Phones only allow sound that follows a tap, so the audio
 * context is created and "unlocked" when a timer is started (see `unlockAudio`), and
 * reused here when it rings.
 */
function beep(context: AudioContext | null) {
  try {
    if (!context) return;
    if (context.state === "suspended") void context.resume();
    // The same rising chime as the audio file: soft attack, then a fade.
    CHIME_NOTES.forEach((frequency, n) => {
      const start = context.currentTime + n * 0.3;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.3, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 1.1);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + 1.15);
    });
  } catch {
    // No sound: the screen still shows it.
  }
}

export function CookMode({
  recipeId,
  title,
  original,
  thermomix,
}: {
  recipeId: string;
  title: string;
  original: Way;
  thermomix: Way | null;
}) {
  const [way, setWay] = useState<"original" | "thermomix">("original");
  const [index, setIndex] = useState(0);
  const [showIngredients, setShowIngredients] = useState(false);
  const [timers, setTimers] = useState<RunningTimer[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const audio = useRef<AudioContext | null>(null);
  const player = useRef<HTMLAudioElement | null>(null);
  const sounds = useRef<{ beep: string; unlock: string } | null>(null);
  // Timers whose ringing the user has silenced.
  const [silenced, setSilenced] = useState<Set<string>>(new Set());

  const current = way === "thermomix" && thermomix ? thermomix : original;
  const step = current.steps[index];
  const last = index === current.steps.length - 1;
  const stepTimers = useMemo(() => (step ? findStepTimers(step.text) : []), [step]);

  // Keep the screen on while cooking.
  useWakeLock(true);

  // One tick per second while a timer runs.
  const anyRunning = timers.some((timer) => timer.endsAt !== null && !timer.done);
  useEffect(() => {
    if (!anyRunning) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [anyRunning]);

  const remaining = (timer: RunningTimer) =>
    timer.done
      ? 0
      : timer.endsAt === null
        ? timer.left
        : Math.min(timer.total, Math.max(0, (timer.endsAt - now) / 1000));
  const finished = (timer: RunningTimer) => timer.endsAt !== null && remaining(timer) <= 0;

  /** The beeps and the vibration; the audio element first, the generated sound if it refuses. */
  const ring = useCallback(() => {
    navigator.vibrate?.([200, 100, 200]);
    const element = player.current;
    const url = sounds.current?.beep;
    if (element && url) {
      element.src = url;
      element.currentTime = 0;
      element.play().catch(() => beep(audio.current));
    } else {
      beep(audio.current);
    }
  }, []);

  // A finished timer rings every few seconds until it is silenced, reset or removed.
  const ringing = timers.some((timer) => finished(timer) && !silenced.has(timer.id));
  useEffect(() => {
    if (!ringing) return;
    ring();
    const id = setInterval(ring, 3000);
    return () => clearInterval(id);
  }, [ringing, ring]);

  /** Called inside a tap (starting a timer): the only moment the browser allows sound to start. */
  function unlockAudio() {
    try {
      // The element: a normal <audio> that has played once after a tap may play again later.
      sounds.current ??= { beep: beepDataUrl(), unlock: unlockDataUrl() };
      player.current ??= new Audio();
      player.current.src = sounds.current.unlock;
      void player.current.play().catch(() => {});
    } catch {
      // Falls back to the generated sound below.
    }
    try {
      audio.current ??= new AudioContext();
      void audio.current.resume();
      const silence = audio.current.createBufferSource();
      silence.buffer = audio.current.createBuffer(1, 1, 22050);
      silence.connect(audio.current.destination);
      silence.start(0);
    } catch {
      // No audio support: only the screen and the vibration.
    }
  }

  function startTimer(label: string, seconds: number) {
    unlockAudio();
    setTimers((all) => [
      ...all,
      { id: crypto.randomUUID(), label, total: seconds, left: seconds, endsAt: Date.now() + seconds * 1000, done: false },
    ]);
  }
  function toggleTimer(id: string) {
    setTimers((all) =>
      all.map((timer) => {
        if (timer.id !== id) return timer;
        if (timer.endsAt !== null) {
          return { ...timer, left: Math.max(0, (timer.endsAt - Date.now()) / 1000), endsAt: null };
        }
        return { ...timer, endsAt: Date.now() + timer.left * 1000 };
      }),
    );
  }
  function resetTimer(id: string) {
    setSilenced((all) => {
      const next = new Set(all);
      next.delete(id);
      return next;
    });
    setTimers((all) => all.map((t) => (t.id === id ? { ...t, left: t.total, endsAt: null, done: false } : t)));
  }
  function removeTimer(id: string) {
    setTimers((all) => all.filter((timer) => timer.id !== id));
  }

  function switchWay(next: "original" | "thermomix") {
    setWay(next);
    setIndex(0);
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background pt-[env(safe-area-inset-top)]">
      <header className="flex items-center gap-2 border-b px-3 py-2">
        <Link
          href={`/recetas/${recipeId}`}
          className={buttonVariants({ variant: "ghost", size: "icon-lg", className: "size-10" })}
          aria-label="Salir del modo cocinar"
          title="Salir"
        >
          <X className="size-5" />
        </Link>
        <h1 className="min-w-0 flex-1 truncate font-heading font-semibold">{title}</h1>
        {thermomix && (
          <div className="flex rounded-lg bg-muted p-0.5" role="group" aria-label="Versión">
            <Button
              type="button"
              variant={way === "original" ? "default" : "ghost"}
              size="sm"
              onClick={() => switchWay("original")}
            >
              Receta
            </Button>
            <Button
              type="button"
              variant={way === "thermomix" ? "default" : "ghost"}
              size="sm"
              onClick={() => switchWay("thermomix")}
              aria-label="Versión Thermomix"
            >
              <ThermomixIcon className="size-4" />
            </Button>
          </div>
        )}
        <Button
          type="button"
          variant="outline"
          size="icon-lg"
          className="size-10"
          onClick={() => {
            unlockAudio();
            ring();
          }}
          aria-label="Probar el sonido del aviso"
          title="Probar el sonido del aviso"
        >
          <Volume2 className="size-5" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon-lg"
          className="size-10"
          onClick={() => setShowIngredients(true)}
          aria-label="Ver los ingredientes"
          title="Ingredientes"
        >
          <ShoppingBasket className="size-5" />
        </Button>
      </header>

      {step ? (
        <main className="flex flex-1 flex-col gap-5 overflow-y-auto px-5 py-6">
          <p className="text-sm font-medium text-muted-foreground">
            Paso {index + 1} de {current.steps.length}
          </p>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${((index + 1) / current.steps.length) * 100}%` }}
            />
          </div>
          <p className="text-2xl leading-snug font-medium">{step.text}</p>
          {step.settings.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {step.settings.map((setting) => (
                <Badge key={setting} variant="secondary" className="px-3 py-1 text-base">
                  {setting}
                </Badge>
              ))}
            </div>
          )}
          {way === "original" && stepTimers.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {stepTimers.map((timer) => (
                <Button
                  key={timer.seconds}
                  type="button"
                  variant="outline"
                  onClick={() => startTimer(timer.label, timer.seconds)}
                >
                  <Timer /> {timer.label}
                </Button>
              ))}
            </div>
          )}
        </main>
      ) : (
        <main className="flex flex-1 items-center justify-center p-6 text-center text-muted-foreground">
          Esta receta no tiene pasos escritos aquí.
        </main>
      )}

      {timers.length > 0 && (
        <ul className="flex flex-col gap-1.5 border-t bg-muted/40 px-3 py-2">
          {timers.map((timer) => {
            const isDone = finished(timer);
            return (
              <li
                key={timer.id}
                className={cn(
                  "flex items-center gap-2 rounded-lg border bg-background px-3 py-1.5",
                  isDone && !silenced.has(timer.id) ? "animate-pulse border-primary bg-primary/10" : isDone && "border-primary bg-primary/10",
                )}
              >
                <Timer className={cn("size-4 shrink-0", isDone && "text-primary")} aria-hidden />
                <span className="min-w-0 flex-1 truncate text-sm">{timer.label}</span>
                <span className={cn("font-mono text-lg tabular-nums", isDone && "font-semibold text-primary")}>
                  {isDone ? "¡Listo!" : formatClock(remaining(timer))}
                </span>
                {isDone && !silenced.has(timer.id) && (
                  <Button
                    type="button"
                    size="icon"
                    onClick={() => setSilenced((all) => new Set(all).add(timer.id))}
                    aria-label="Silenciar el aviso"
                    title="Silenciar"
                  >
                    <BellOff />
                  </Button>
                )}
                {!isDone && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => toggleTimer(timer.id)}
                    aria-label={timer.endsAt === null ? "Reanudar" : "Pausar"}
                  >
                    {timer.endsAt === null ? <Play /> : <Pause />}
                  </Button>
                )}
                <Button type="button" variant="ghost" size="icon" onClick={() => resetTimer(timer.id)} aria-label="Reiniciar">
                  <RotateCcw />
                </Button>
                <Button type="button" variant="ghost" size="icon" onClick={() => removeTimer(timer.id)} aria-label="Quitar el cronómetro">
                  <X />
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      <footer className="grid grid-cols-[1fr_2fr] gap-3 border-t p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <Button
          type="button"
          variant="outline"
          className="h-14"
          disabled={index === 0}
          onClick={() => setIndex(index - 1)}
          aria-label="Paso anterior"
        >
          <ChevronLeft className="size-7" />
        </Button>
        {last ? (
          <Link
            href={`/recetas/${recipeId}`}
            className={buttonVariants({ className: "h-14" })}
            aria-label="Terminar"
          >
            <Check className="size-7" />
          </Link>
        ) : (
          <Button type="button" className="h-14" onClick={() => setIndex(index + 1)} aria-label="Paso siguiente">
            <ChevronRight className="size-7" />
          </Button>
        )}
      </footer>

      {showIngredients && (
        <div className="absolute inset-0 z-10 flex flex-col bg-background/95 backdrop-blur" role="dialog" aria-label="Ingredientes">
          <div className="flex items-center justify-between gap-2 border-b px-3 py-2 pt-[calc(0.5rem+env(safe-area-inset-top))]">
            <h2 className="font-heading font-semibold">Ingredientes</h2>
            <Button type="button" variant="ghost" size="icon-lg" className="size-10" onClick={() => setShowIngredients(false)} aria-label="Cerrar">
              <X className="size-5" />
            </Button>
          </div>
          <ul className="flex-1 divide-y overflow-y-auto px-5">
            {current.ingredients.map((line, i) => (
              <li key={i} className="py-3 text-lg">
                {line}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
