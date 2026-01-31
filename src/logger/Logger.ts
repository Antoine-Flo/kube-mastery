// ═══════════════════════════════════════════════════════════════════════════
// APPLICATION LOGGER
// ═══════════════════════════════════════════════════════════════════════════

import type { LogLevel, LogCategory, LogEntry, LogObserver } from "./types";

export interface Logger {
	info(category: LogCategory, message: string): void;
	warn(category: LogCategory, message: string): void;
	error(category: LogCategory, message: string): void;
	debug(category: LogCategory, message: string): void;
	getEntries(filter?: {
		level?: LogLevel;
		category?: LogCategory;
	}): LogEntry[];
	clear(): void;
	subscribe(observer: LogObserver): () => void;
}

interface LoggerOptions {
	maxEntries?: number;
	mirrorToConsole?: boolean;
}

const createLogEntry = (
	level: LogLevel,
	category: LogCategory,
	message: string,
): LogEntry => ({
	timestamp: new Date().toISOString(),
	level,
	category,
	message,
});

const createConsoleObserver = (): LogObserver => {
	const consoleMap: Record<LogLevel, (msg: string) => void> = {
		error: console.error,
		warn: console.warn,
		debug: console.debug,
		info: console.log,
	};
	return (entry: LogEntry) => {
		if (entry.category === "COMMAND") return;
		const prefix = `[${entry.level.toUpperCase()}] [${entry.category}]`;
		consoleMap[entry.level](`${prefix} ${entry.message}`);
	};
};

const matchesFilter = (
	entry: LogEntry,
	filter: { level?: LogLevel; category?: LogCategory },
): boolean => {
	if (filter.level && entry.level !== filter.level) return false;
	if (filter.category && entry.category !== filter.category) return false;
	return true;
};

export const createLogger = (options: LoggerOptions = {}): Logger => {
	const maxEntries = options.maxEntries ?? 500;
	const observers: LogObserver[] = [];
	let entries: LogEntry[] = [];

	if (options.mirrorToConsole) {
		observers.push(createConsoleObserver());
	}

	const appendEntry = (
		level: LogLevel,
		category: LogCategory,
		message: string,
): void => {
		const entry = createLogEntry(level, category, message);
		entries = [...entries, entry];
		if (entries.length > maxEntries) entries = entries.slice(1);
		observers.forEach((obs) => obs(entry));
	};

	return {
		info: (c, m) => appendEntry("info", c, m),
		warn: (c, m) => appendEntry("warn", c, m),
		error: (c, m) => appendEntry("error", c, m),
		debug: (c, m) => appendEntry("debug", c, m),
		getEntries: (filter) =>
			filter ? entries.filter((e) => matchesFilter(e, filter)) : [...entries],
		clear: () => {
			entries = [];
		},
		subscribe: (observer) => {
			observers.push(observer);
			return () => {
				const i = observers.indexOf(observer);
				if (i > -1) observers.splice(i, 1);
			};
		},
	};
};
