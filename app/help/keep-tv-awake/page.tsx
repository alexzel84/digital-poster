export default function KeepTvAwakePage() {
  return (
    <div className="mx-auto max-w-xl px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Keep your TV awake</h1>
      <p className="mt-3 text-muted-foreground">
        Digital Poster tries to keep your TV&apos;s screen from sleeping
        automatically using your browser&apos;s wake lock feature, but not
        every TV browser supports this. For reliable 24/7 display, also
        disable your TV&apos;s own sleep, screensaver, and auto-power-off
        settings.
      </p>

      <div className="mt-8 space-y-6">
        <section>
          <h2 className="font-medium">Samsung TVs (Tizen)</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Settings → General → System Manager → Auto Power Off — turn off.
            Also check Settings → General → Power and Energy Saving → set
            Auto Power Off to Off.
          </p>
        </section>

        <section>
          <h2 className="font-medium">LG TVs (webOS)</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Settings → General → Timers → Sleep Timer and Auto Off — turn
            both off. Check Settings → Support → Quick Help for an Energy
            Saving mode as well.
          </p>
        </section>

        <section>
          <h2 className="font-medium">Amazon Fire TV</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Settings → Display &amp; Sounds → Screen Saver — set the wait
            time to Never (or the maximum available). Also check Settings →
            Preferences → Power to disable sleep timers if present.
          </p>
        </section>

        <section>
          <h2 className="font-medium">Android TV / Google TV</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Settings → Device Preferences → Screen Saver — set to Never
            start, or the longest available option. Also check Sleep Timer
            settings under Device Preferences if your device has one.
          </p>
        </section>

        <section>
          <h2 className="font-medium">General tip</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            If your TV still sleeps after adjusting these settings, look
            for an &ldquo;Energy Saving&rdquo; or &ldquo;Eco Mode&rdquo;
            setting — these often override the screensaver/sleep timer
            settings above and need to be turned off separately.
          </p>
        </section>
      </div>
    </div>
  );
}
