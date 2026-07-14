"use server";

import { redirect } from "next/navigation";
import { notifyContactMessage } from "@/lib/notifications";

export async function submitContactMessage(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();

  if (!name || !email || !message) {
    redirect("/contact?error=1");
  }

  try {
    await notifyContactMessage({ name, email, message });
  } catch (err) {
    console.error("Failed to send Contact Us message:", err);
    redirect("/contact?error=1");
  }

  redirect("/contact?sent=1");
}
