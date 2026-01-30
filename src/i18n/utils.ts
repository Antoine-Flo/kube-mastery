import { ui, defaultLang, showDefaultLang } from "./ui.js";

export type UiLang = keyof typeof ui;

export function getLangFromUrl(url: URL): UiLang {
	const [, lang] = url.pathname.split("/");
	if (lang && lang in ui) {
		return lang as UiLang;
	}
	return defaultLang;
}

/** Path without locale prefix, for building same-page links in other locales (e.g. /fr/terms-of-service → /terms-of-service). */
export function getPathWithoutLocale(url: URL): string {
	const segments = url.pathname.split("/").filter(Boolean);
	if (segments.length === 0) {
		return "/";
	}
	const first = segments[0];
	if (first in ui) {
		if (segments.length === 1) {
			return "/";
		}
		return "/" + segments.slice(1).join("/");
	}
	return url.pathname || "/";
}

export function useTranslations(lang: UiLang) {
	return function t(key: keyof (typeof ui)[typeof defaultLang]) {
		return ui[lang][key as string] ?? ui[defaultLang][key as string] ?? key;
	};
}

export function useTranslatedPath(lang: UiLang) {
	return function translatePath(path: string, l: UiLang = lang): string {
		const effectiveLang = l ?? lang;
		return path === "/" ? `/${effectiveLang}` : `/${effectiveLang}${path}`;
	};
}

/** Path with locale prefix: /en for en, /fr for fr (single [lang] segment, no duplicate pages). */
export function useLocalePath(locale: UiLang) {
	return function localePath(path: string): string {
		return path === "/" ? `/${locale}` : `/${locale}${path}`;
	};
}
