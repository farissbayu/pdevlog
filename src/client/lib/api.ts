import { hc } from "hono/client";

import type { AppType } from "@/worker/index";

export const client = hc<AppType>("/", {
  init: {
    credentials: "include",
  },
});
