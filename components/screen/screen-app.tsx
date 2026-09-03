"use client";

import { useEffect, useState } from "react";
import { getScreenAuth, type ScreenAuth } from "@/lib/screen/local-auth";
import { PairingForm } from "@/components/screen/pairing-form";
import { Player } from "@/components/screen/player";
import { registerServiceWorker } from "@/lib/screen/register-sw";

type State =
  | { status: "checking" }
  | { status: "pairing" }
  | { status: "paired"; auth: ScreenAuth };

export function ScreenApp() {
  const [state, setState] = useState<State>({ status: "checking" });

  useEffect(() => {
    registerServiceWorker();
    const auth = getScreenAuth();
    setState(auth ? { status: "paired", auth } : { status: "pairing" });
  }, []);

  if (state.status === "checking") {
    return <div className="h-full w-full bg-black" />;
  }

  if (state.status === "pairing") {
    return (
      <PairingForm
        onPaired={(auth) => setState({ status: "paired", auth })}
      />
    );
  }

  return (
    <Player
      screenId={state.auth.screenId}
      screenToken={state.auth.screenToken}
      onDisconnected={() => setState({ status: "pairing" })}
    />
  );
}
