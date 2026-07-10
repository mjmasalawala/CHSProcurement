"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn } from "@/auth";

// Only ever redirect within our own app — an absolute/external callbackUrl
// would be an open-redirect vector.
function safeCallbackUrl(formData: FormData): string {
  const value = formData.get("callbackUrl");
  return typeof value === "string" && value.startsWith("/") ? value : "/app";
}

export async function signInWithGoogle(formData: FormData) {
  await signIn("google", { redirectTo: safeCallbackUrl(formData) });
}

export async function signInWithCredentials(formData: FormData) {
  const callbackUrl = safeCallbackUrl(formData);
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: callbackUrl,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      redirect(`/login?error=invalid_credentials&callbackUrl=${encodeURIComponent(callbackUrl)}`);
    }
    throw err;
  }
}
