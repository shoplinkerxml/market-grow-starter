// Global type declarations for Deno environment
declare global {
  interface Window {
    Deno: any;
  }
  
  var Deno: any;
}

// Supabase environment variables
declare namespace Deno {
  namespace env {
    function get(key: string): string | undefined;
  }
}

export {};