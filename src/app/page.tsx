import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 bg-background-primary px-6 py-24 text-center">
      <h1 className="text-[24px] font-bold text-text-primary">Bluejay</h1>
      <p className="max-w-md text-[15px] text-text-secondary">
        Housing society R&amp;M vendor marketplace. Scaffold milestone — landing page ships in M2.
      </p>
      <Card className="w-full max-w-sm text-left">
        <p className="mb-3 text-[13px] text-text-secondary">UI kit check</p>
        <Button>Primary action</Button>
      </Card>
    </main>
  );
}
