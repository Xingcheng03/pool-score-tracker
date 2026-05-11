import React, { createContext, useContext, useState, useCallback } from "react";

const STORAGE_KEY = "app.lang";

const LanguageContext = createContext({ lang: "zh", setLang: () => {} });

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    if (typeof window === "undefined") return "zh";
    return window.localStorage.getItem(STORAGE_KEY) || "zh";
  });

  const setLang = useCallback((next) => {
    setLangState(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, next);
    }
  }, []);

  return (
    <LanguageContext.Provider value={{ lang, setLang }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}

export function useT() {
  const { lang } = useLanguage();
  return useCallback((zh, en) => (lang === "en" ? en : zh), [lang]);
}

const STAR_NUM = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
const TIER_ROLE_EN = {
  "匕首":   "Dagger",
  "斗者":   "Pool Fighter",
  "斗师":   "Pool Master",
  "大斗师": "Grand Pool Master",
  "斗灵":   "Pool Spirit",
  "斗王":   "Pool King",
  "斗皇":   "Pool Sovereign",
  "斗宗":   "Pool Ancestor",
  "斗尊":   "Pool Venerable",
  "斗圣":   "Pool Saint",
};

export function translateTier(tier, lang) {
  if (lang !== "en" || !tier) return tier;
  if (tier === "斗帝") return "Pool Emperor";
  if (tier === "大匕首") return "Great Dagger";
  const m = String(tier).match(/^([一二三四五六七八九])星(.+)$/);
  if (!m) return tier;
  const [, ch, role] = m;
  const en = TIER_ROLE_EN[role];
  return en ? `${STAR_NUM[ch]}-Star ${en}` : tier;
}

export function useTranslateTier() {
  const { lang } = useLanguage();
  return useCallback((tier) => translateTier(tier, lang), [lang]);
}
