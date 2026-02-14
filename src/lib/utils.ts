import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function cleanupDialogArtifacts() {
  try {
    document.querySelectorAll('[inert]').forEach((el) => {
      el.removeAttribute('inert');
    });
    document.querySelectorAll('[aria-hidden="true"]').forEach((el) => {
      el.removeAttribute('aria-hidden');
    });
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
    document.documentElement.classList.remove('react-remove-scroll');
    document.body.classList.remove('react-remove-scroll');
  } catch {
    void 0;
  }
}
