"use client";

import React from "react";
import { EchoProvider } from "@/components/echo/echo-provider";

export function GlobalEchoProvider({ children }: { children: React.ReactNode }) {
  // For authenticated areas, a later iteration can supply a real token.
  // For now, we provide the context so `useEcho()` never throws.
  return <EchoProvider token={null}>{children}</EchoProvider>;
}
