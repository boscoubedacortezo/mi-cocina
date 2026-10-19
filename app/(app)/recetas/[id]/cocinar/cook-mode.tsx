"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  RotateCcw,
  ShoppingBasket,
  Timer,
  X,
} from "lucide-react";
import { ThermomixIcon } from "@/components/equipment-icons";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
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

/** A short beep and a vibration: the timer must be noticed with the phone on the counter. */
function alarm() {
  try {
    navigator.vibrate?.([300, 150, 300, 150, 300]);
    const context = new AudioContext();
    [0, 0.35, 0.7].forEach((delay) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = 880;
      gain.gain.value = 0.2;
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(context.currentTime + delay);
      oscillator.stop(context.currentTime + delay + 0.2);
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
  const alarmed = useRef(new Set<string>());

  const current = way === "thermomix" && thermomix ? thermomix : original;
  const step = current.steps[index];
  const last = index === current.steps.length - 1;
  const stepTimers = useMemo(() => (step ? findStepTimers(step.text) : []), [step]);

  // Keep the screen on while cooking, and take the lock again if the tab was hidden.
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    const request = async () => {
      try {
        lock = (await navigator.wakeLock?.request("screen")) ?? null;
      } catch {
        // Not supported or refused: the screen may dim, nothing else.
      }
    };
    request();
    const onVisible = () => document.visibilityState === "visible" && request();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      lock?.release().catch(() => {});
    };
  }, []);

  // One tick per second while a timer runs.
  const anyRunning = timers.some((timer) => timer.endsAt !== null && !timer.done);
  useEffect(() => {
    if (!anyRunning) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [anyRunning]);

  useEffect(() => {
    for (const timer of timers) {
      if (timer.endsAt === null || timer.done || timer.endsAt > now) continue;
      if (!alarmed.current.has(timer.id)) {
        alarmed.current.add(timer.id);
        alarm();
      }
    }
  }, [now, timers]);

  // `now` may be a moment behind right after a timer starts: never show more than its total.
  const remaining = (timer: RunningTimer) =>
    timer.done
      ? 0
      : timer.endsAt === null
        ? timer.left
        : Math.min(timer.total, Math.max(0, (timer.endsAt - now) / 1000));
  const finished = (timer: RunningTimer) => timer.endsAt !== null && remaining(timer) <= 0;

  function startTimer(label: string, seconds: number) {
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
    alarmed.current.delete(id);
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
                  isDone && "border-primary bg-primary/10",
                )}
              >
                <Timer className={cn("size-4 shrink-0", isDone && "text-primary")} aria-hidden />
                <span className="min-w-0 flex-1 truncate text-sm">{timer.label}</span>
                <span className={cn("font-mono text-lg tabular-nums", isDone && "font-semibold text-primary")}>
                  {isDone ? "¡Listo!" : formatClock(remaining(timer))}
                </span>
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
