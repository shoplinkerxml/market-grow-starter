import DOMPurify from "dompurify";

/**
 * Sanitize untrusted HTML before injecting via dangerouslySetInnerHTML.
 * Strips scripts, event handlers, and dangerous URI schemes while
 * preserving common formatting tags used in CMS content.
 */
export function sanitizeHtml(html: unknown): string {
  if (!html || typeof html !== "string") return "";
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ["style", "script", "iframe", "object", "embed", "form"],
    FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover", "onfocus", "onblur"],
  });
}