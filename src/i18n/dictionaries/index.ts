import type { Dictionary, Lang } from "../types";

let cachedLang: Lang | null = null;
let cachedDictionary: Dictionary | null = null;
let loadPromise: Promise<Dictionary> | null = null;

const mergeDictionaries = (dicts: Dictionary[]): Dictionary => {
  const result: Dictionary = {};
  for (const dict of dicts) {
    for (const key in dict) {
      result[key] = dict[key];
    }
  }
  return result;
};

export const loadDictionary = async (lang: Lang): Promise<Dictionary> => {
  if (cachedDictionary && cachedLang === lang) {
    return cachedDictionary;
  }

  if (loadPromise && cachedLang === lang) {
    return loadPromise;
  }

  cachedLang = lang;

  loadPromise = Promise.all([
    import("./common").then((mod) => mod.commonDictionary),
    import("./auth").then((mod) => mod.authDictionary),
    import("./products").then((mod) => mod.productsDictionary),
    import("./suppliers").then((mod) => mod.suppliersDictionary),
    import("./shops").then((mod) => mod.shopsDictionary),
    import("./users").then((mod) => mod.usersDictionary),
    import("./tariffs").then((mod) => mod.tariffsDictionary),
  ]).then((dicts) => mergeDictionaries(dicts));

  const dictionary = await loadPromise;
  cachedDictionary = dictionary;
  loadPromise = null;

  return dictionary;
};
