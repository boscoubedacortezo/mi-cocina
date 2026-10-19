"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Mic, Square } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/* The browser's own speech recognition (not in every TypeScript lib, so typed here). */
type RecognitionEvent = {
  resultIndex: number;
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
};
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type RecognitionConstructor = new () => Recognition;

function recognitionConstructor(): RecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const ERRORS: Record<string, string> = {
  "not-allowed": "No hay permiso para el micrófono. Actívalo en los ajustes del navegador.",
  "service-not-allowed": "Este navegador no deja dictar desde aquí. Usa el micrófono del teclado.",
  "audio-capture": "No encuentro el micrófono.",
  network: "El dictado necesita conexión a internet.",
};

/**
 * Dictation that keeps listening: the phone's keyboard microphone stops after a few seconds,
 * but this one starts again by itself until the user stops it. What is said is added to the
 * end of the text already in the field.
 */
export function DictationButton({
  value,
  onChange,
  disabled,
  className,
}: {
  value: string;
  onChange: (text: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  // Known only in the browser; the server render and the first paint say "no".
  const supported = useSyncExternalStore(
    () => () => {},
    () => recognitionConstructor() !== null,
    () => false,
  );
  const [listening, setListening] = useState(false);
  const recognition = useRef<Recognition | null>(null);
  const wanted = useRef(false);
  // The text before this stretch of dictation and what has been confirmed in it.
  const base = useRef("");
  const heard = useRef("");
  const latest = useRef(value);

  useEffect(() => {
    latest.current = value;
  }, [value]);
  useEffect(() => {
    return () => {
      wanted.current = false;
      recognition.current?.stop();
    };
  }, []);

  function join(prefix: string, addition: string) {
    const clean = addition.trim();
    if (!clean) return prefix;
    return prefix && !/\s$/.test(prefix) ? `${prefix} ${clean}` : `${prefix}${clean}`;
  }

  function begin() {
    const Constructor = recognitionConstructor();
    if (!Constructor) return;
    const instance = new Constructor();
    instance.lang = "es-ES";
    instance.continuous = true;
    instance.interimResults = true;
    base.current = latest.current;
    heard.current = "";

    instance.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0]?.transcript ?? "";
        if (result.isFinal) heard.current = join(heard.current, text);
        else interim = join(interim, text);
      }
      onChange(join(join(base.current, heard.current), interim));
    };
    instance.onerror = (event) => {
      // Silence and cut connections just end the stretch; the restart below carries on.
      if (event.error === "no-speech" || event.error === "aborted") return;
      wanted.current = false;
      setListening(false);
      toast.error(ERRORS[event.error] ?? "El dictado se ha detenido.");
    };
    instance.onend = () => {
      // The browser ends a stretch after a few seconds or a pause: start the next one.
      if (wanted.current) {
        setTimeout(() => {
          if (wanted.current) begin();
        }, 150);
      } else {
        setListening(false);
      }
    };
    recognition.current = instance;
    try {
      instance.start();
    } catch {
      // Already running: nothing to do.
    }
  }

  function toggle() {
    if (listening) {
      wanted.current = false;
      recognition.current?.stop();
      setListening(false);
      return;
    }
    wanted.current = true;
    setListening(true);
    begin();
  }

  if (!supported) return null;
  return (
    <Button
      type="button"
      variant={listening ? "default" : "outline"}
      size="icon-lg"
      className={cn("size-10", listening && "animate-pulse", className)}
      disabled={disabled}
      onClick={toggle}
      aria-pressed={listening}
      aria-label={listening ? "Parar el dictado" : "Dictar con la voz"}
      title={listening ? "Parar el dictado" : "Dictar con la voz"}
    >
      {listening ? <Square className="size-4 fill-current" /> : <Mic className="size-5" />}
    </Button>
  );
}
