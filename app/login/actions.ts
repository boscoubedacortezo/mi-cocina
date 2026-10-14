"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { isAllowedEmail } from "@/lib/auth";
import { getOrigin } from "@/lib/origin";
import { createClient } from "@/lib/supabase/server";

export type LoginState = {
  step: "email" | "code";
  email: string;
  message?: string;
  error?: string;
};

const emailSchema = z.email("Introduce un email válido.");
const codeSchema = z
  .string()
  .trim()
  .regex(/^\d{6,10}$/, "El código son los dígitos que aparecen en el email.");

export async function sendLoginEmail(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = emailSchema.safeParse(
    String(formData.get("email") ?? "").trim().toLowerCase(),
  );
  if (!parsed.success) {
    return { step: "email", email: "", error: parsed.error.issues[0].message };
  }
  const email = parsed.data;
  const sentState: LoginState = {
    step: "code",
    email,
    message:
      "Si el email tiene acceso, te hemos enviado un enlace y un código. Abre el enlace o escribe el código aquí.",
  };

  // Same response for unknown emails so the allowed address is not revealed.
  if (!isAllowedEmail(email)) return sentState;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: `${await getOrigin()}/auth/confirm`,
    },
  });
  if (error) {
    return {
      step: "email",
      email,
      error: "No se pudo enviar el email. Inténtalo de nuevo en un minuto.",
    };
  }
  return sentState;
}

export async function verifyLoginCode(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const parsed = codeSchema.safeParse(String(formData.get("code") ?? ""));
  if (!parsed.success) {
    return { step: "code", email, error: parsed.error.issues[0].message };
  }
  const invalid: LoginState = {
    step: "code",
    email,
    error: "Código incorrecto o caducado.",
  };
  if (!isAllowedEmail(email)) return invalid;

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    email,
    token: parsed.data,
    type: "email",
  });
  if (error) return invalid;
  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
