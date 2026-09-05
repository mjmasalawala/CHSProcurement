"use server";

import { revalidatePath } from "next/cache";
import { setMarketingSubscribed } from "@/lib/messaging/preferences";

export async function updateMarketingSubscription(token: string, subscribed: boolean): Promise<void> {
  await setMarketingSubscribed(token, subscribed);
  revalidatePath(`/preferences/${token}`);
}
