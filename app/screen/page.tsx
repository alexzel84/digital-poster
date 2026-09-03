import { ScreenApp } from "@/components/screen/screen-app";

// This route intentionally imports nothing from components/dashboard or
// components/ui — the TV bundle should never pull in admin-only code.
export default function ScreenPage() {
  return <ScreenApp />;
}
