import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 bg-background-primary px-6 py-24 text-center">
      <h1 className="text-[24px] font-bold text-text-primary">Bluejay</h1>
      <p className="max-w-md text-[15px] text-text-secondary">
        Housing society R&amp;M vendor marketplace. Landing page ships in M2 — for now, log in.
      </p>
      <Link href="/login">
        <Button>Log in</Button>
      </Link>
    </main>
  );
}
