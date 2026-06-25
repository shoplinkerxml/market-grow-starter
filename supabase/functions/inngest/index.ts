import { Inngest, NonRetriableError } from "npm:inngest@^3";
import { serve } from "npm:inngest@^3/deno";
import { supplierImport } from "./supplier-import.ts";

// Inngest client for MarketGrow background jobs.
// Reads INNGEST_SIGNING_KEY from env (provided by the Lovable Inngest connector).
export const inngest = new Inngest({ id: "marketgrow" });

const functions = [supplierImport(inngest, NonRetriableError)];

export default serve({ client: inngest, functions });