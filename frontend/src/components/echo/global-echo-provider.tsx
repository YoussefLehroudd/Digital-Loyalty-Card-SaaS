"use client";

import React from "react";
import { EchoProvider } from "@/components/echo/echo-provider";

export function GlobalEchoProvider({ children }: { children: React.ReactNode }) {
  return <EchoProvider token={null}>{children}</EchoProvider>;
}
