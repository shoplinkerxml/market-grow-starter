import { Inngest } from "npm:inngest@^3";
import { serve } from "npm:inngest@^3/deno";

// Inngest client for MarketGrow background jobs.
// Reads INNGEST_SIGNING_KEY from env (provided by the Lovable Inngest connector).
export const inngest = new Inngest({ id: "marketgrow" });

// No functions registered yet — this is the skeleton serve endpoint.
// Future functions (supplier-import, supplier-import-scheduler, supplier-import-cleanup)
// will be appended to the `functions` array below.
const functions: ReturnType<typeof inngest.createFunction>[] = [];

export default serve({ client: inngest, functions });