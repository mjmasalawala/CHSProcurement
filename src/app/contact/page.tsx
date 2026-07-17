import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { submitContactMessage } from "./actions";

export const metadata: Metadata = {
  title: "Contact Us — ProSoc",
};

export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const { sent, error } = await searchParams;

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <Card className="w-full max-w-sm">
        <h1 className="mb-1 text-[28px] font-bold tracking-tight text-text-primary">Contact Us</h1>
        <p className="mb-6 text-[13px] text-text-secondary">Have a question or need help? Send us a message.</p>

        {sent && (
          <p className="mb-4 text-[13px] text-status-success">
            Thanks — your message has been sent. We&apos;ll get back to you soon.
          </p>
        )}
        {error && (
          <p className="mb-4 text-[13px] text-status-error">
            Something went wrong sending your message. Please try again.
          </p>
        )}

        <form action={submitContactMessage} className="flex flex-col gap-4">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" type="text" required />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <div>
            <Label htmlFor="message">Message</Label>
            <Textarea id="message" name="message" rows={5} required />
          </div>
          <Button type="submit" className="w-full">
            Send message
          </Button>
        </form>
      </Card>
    </main>
  );
}
