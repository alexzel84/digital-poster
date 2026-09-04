export default function TermsOfServicePage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-12">

      <h1 className="text-2xl font-semibold tracking-tight">Terms of Service</h1>
      <p className="mt-1 text-sm text-muted-foreground">Last updated: [DATE]</p>

      <div className="mt-6 space-y-6 text-sm leading-relaxed text-muted-foreground">
        <section>
          <h2 className="font-medium text-foreground">The service</h2>
          <p className="mt-2">
            PosterDeck ([COMPANY NAME]) lets you upload images and
            videos to be displayed on TVs you control, paired to your
            account via a pairing code.
          </p>
        </section>

        <section>
          <h2 className="font-medium text-foreground">Your account</h2>
          <p className="mt-2">
            You&apos;re responsible for keeping your login credentials
            secure and for all activity under your account, including
            content uploaded by anyone you invite to help manage a screen.
          </p>
        </section>

        <section>
          <h2 className="font-medium text-foreground">Acceptable use</h2>
          <p className="mt-2">
            You agree not to upload content that&apos;s illegal, infringes
            someone else&apos;s rights, or that you don&apos;t have
            permission to display. We may remove content or suspend
            accounts that violate this.
          </p>
        </section>

        <section>
          <h2 className="font-medium text-foreground">Your content</h2>
          <p className="mt-2">
            You retain ownership of everything you upload. You&apos;re
            solely responsible for having the rights to display it.
          </p>
        </section>

        <section>
          <h2 className="font-medium text-foreground">Availability and changes</h2>
          <p className="mt-2">
            The service is provided &ldquo;as is,&rdquo; without
            warranties of any kind. We may modify or discontinue features,
            or suspend accounts that violate these terms, and we may
            update these terms from time to time.
          </p>
        </section>

        <section>
          <h2 className="font-medium text-foreground">Limitation of liability</h2>
          <p className="mt-2">
            To the fullest extent permitted by law, [COMPANY NAME] is not
            liable for indirect, incidental, or consequential damages
            arising from your use of the service.
          </p>
        </section>

        <section>
          <h2 className="font-medium text-foreground">Governing law</h2>
          <p className="mt-2">
            These terms are governed by the laws of [JURISDICTION].
          </p>
        </section>

        <section>
          <h2 className="font-medium text-foreground">Contact</h2>
          <p className="mt-2">Questions about these terms: [CONTACT EMAIL]</p>
        </section>
      </div>
    </div>
  );
}
