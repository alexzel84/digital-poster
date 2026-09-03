import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function ScreenNotFound() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
      <p className="text-lg font-medium">Screen not found</p>
      <p className="max-w-sm text-sm text-muted-foreground">
        This screen doesn&apos;t exist, or it isn&apos;t yours.
      </p>
      <Link href="/dashboard">
        <Button variant="outline" size="sm">
          Back to your screens
        </Button>
      </Link>
    </div>
  );
}
