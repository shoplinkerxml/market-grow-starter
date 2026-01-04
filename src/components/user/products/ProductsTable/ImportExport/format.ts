export function formatTokens(src: string, tokens: Record<string, string | number>): string {
  let out = src;
  for (const k of Object.keys(tokens)) {
    out = out.split(`{${k}}`).join(String(tokens[k]));
  }
  return out;
}

