import { create } from "zustand";
import type { Dictionary, Lang } from "./types";
import { loadDictionary } from "./dictionaries";

type I18nState = {
  lang: Lang;
  dictionary: Dictionary | null;
  loading: boolean;
  error: string | null;
  t: (key: string) => string;
  setLang: (lang: Lang) => void;
  init: (lang?: Lang) => Promise<void>;
};

export const useI18nStore = create<I18nState>((set, get) => ({
  lang: "uk",
  dictionary: null,
  loading: false,
  error: null,
  t: (key) => {
    const state = get();
    const { dictionary, lang } = state;
    const dict = dictionary || {};
    const entry = dict[key as keyof typeof dict] as unknown as Record<Lang, string> | undefined;

    if (!entry) {
      return `[${key}]`;
    }

    const value = entry[lang];

    if (typeof value !== "string") {
      return `[${key}]`;
    }

    return value;
  },
  setLang: (lang) => {
    if (lang === get().lang) {
      return;
    }
    set({ lang });
  },
  init: async (langArg) => {
    const currentLang = get().lang;
    const targetLang = langArg ?? currentLang;

    if (get().loading && targetLang === currentLang && get().dictionary) {
      return;
    }

    set({ loading: true, error: null });

    try {
      const dictionary = await loadDictionary(targetLang);
      set({ dictionary, lang: targetLang, loading: false });
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : "Failed to load translations",
      });
    }
  },
}));

