import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { RouterProvider } from "react-router";

import { AppProviders } from "@/client/app/providers";
import { router } from "@/client/app/router";
import type { MeResponse } from "@/shared/schemas/auth";

import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import "./index.css";

const initialMe = (
  window as Window & { __PDEVLOG_ME__?: MeResponse }
).__PDEVLOG_ME__;

const rootElement = document.getElementById("root")!;

const app = (
  <StrictMode>
    <AppProviders initialMe={initialMe}>
      <RouterProvider router={router} />
    </AppProviders>
  </StrictMode>
);

if (rootElement.hasChildNodes()) {
  hydrateRoot(rootElement, app);
} else {
  createRoot(rootElement).render(app);
}
