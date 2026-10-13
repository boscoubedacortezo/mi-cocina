"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  sendLoginEmail,
  verifyLoginCode,
  type LoginState,
} from "./actions";

const initialState: LoginState = { step: "email", email: "" };

export function LoginForm({ initialError }: { initialError?: string }) {
  const [emailState, emailAction, sending] = useActionState(
    sendLoginEmail,
    { ...initialState, error: initialError },
  );
  const [codeState, codeAction, verifying] = useActionState(
    verifyLoginCode,
    initialState,
  );
  const [editingEmail, setEditingEmail] = useState(false);

  const showCodeStep = emailState.step === "code" && !editingEmail;

  if (!showCodeStep) {
    return (
      <form
        action={(formData) => {
          setEditingEmail(false);
          emailAction(formData);
        }}
        className="flex flex-col gap-4"
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            defaultValue={emailState.email}
            required
          />
        </div>
        {emailState.error && (
          <p className="text-sm text-destructive">{emailState.error}</p>
        )}
        <Button type="submit" size="lg" disabled={sending}>
          {sending ? "Enviando…" : "Enviar enlace de acceso"}
        </Button>
      </form>
    );
  }

  return (
    <form
      action={(formData) => {
        formData.set("email", emailState.email);
        codeAction(formData);
      }}
      className="flex flex-col gap-4"
    >
      <p className="text-sm text-muted-foreground">{emailState.message}</p>
      <div className="flex flex-col gap-2">
        <Label htmlFor="code">Código</Label>
        <Input
          id="code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d*"
          maxLength={10}
          required
        />
      </div>
      {codeState.error && (
        <p className="text-sm text-destructive">{codeState.error}</p>
      )}
      <Button type="submit" size="lg" disabled={verifying}>
        {verifying ? "Comprobando…" : "Entrar"}
      </Button>
      <Button
        type="button"
        variant="ghost"
        onClick={() => setEditingEmail(true)}
      >
        Usar otro email
      </Button>
    </form>
  );
}
