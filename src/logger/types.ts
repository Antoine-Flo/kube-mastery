// ═══════════════════════════════════════════════════════════════════════════
// LOGGER TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type LogLevel = "info" | "warn" | "error" | "debug";

export type LogCategory =
	| "COMMAND"
	| "EXECUTOR"
	| "FILESYSTEM"
	| "CLUSTER"
	| "SYSTEM";

export interface LogEntry {
	timestamp: string;
	level: LogLevel;
	category: LogCategory;
	message: string;
}

export type LogObserver = (entry: LogEntry) => void;
