import { ChangePasswordForm } from "@/components/dashboard/change-password-form";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold tracking-tight">Settings</h1>

      <div>
        <h2 className="text-sm font-medium">Change password</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          You&apos;ll need to enter your current password to confirm.
        </p>
        <div className="mt-4">
          <ChangePasswordForm />
        </div>
      </div>
    </div>
  );
}
