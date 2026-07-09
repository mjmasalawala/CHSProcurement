"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn } from "@/auth";

export async function signInWithGoogle() {
  await signIn("google", { redirectTo: "/app" });
}

export async function signInWithCredentials(formData: FormData) {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/app",
    });
  } catch (err) {
    if (err instanceof AuthError) {
      redirect("/login?error=invalid_credentials");
    }
    throw err;
  }
}
