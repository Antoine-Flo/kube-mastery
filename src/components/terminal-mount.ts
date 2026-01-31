// ═══════════════════════════════════════════════════════════════════════════
// TERMINAL MOUNT
// ═══════════════════════════════════════════════════════════════════════════
// Mounts xterm with minimal EmulatedEnvironment. CommandDispatcher on first command.

import {
	createEmulatedEnvironmentLazy,
	destroyEmulatedEnvironmentLazy,
	type EmulatedEnvironment,
} from "../core/emulatedEnvironment/lazy";
import { createFileSystem } from "../core/filesystem/FileSystem";
import { createCommandDispatcher } from "../core/terminal/core/CommandDispatcher";
import {
	attachTerminal,
	detachTerminal,
	getTerminalController,
	initTerminalManager,
	updateTerminalTheme,
} from "../core/terminal/TerminalManager";
import { createLogger } from "../logger/Logger";

const DEFAULT_WELCOME =
	"\x1b[36m☸ Kube Mastery\x1b[0m - Learn Kubernetes hands-on\r\nTry: \x1b[33mkubectl get pods\x1b[0m or \x1b[33mkubectl describe pod <pod-name>\x1b[0m\r\n\r\n";

function getTheme(): "dark" | "light" {
	return document.documentElement.getAttribute("data-theme") === "light"
		? "light"
		: "dark";
}

export interface MountTerminalOptions {
	rows?: number;
	scrollback?: number;
	welcomeMessage?: string;
}

/** Mounts xterm, returns cleanup (detach + destroy env). */
export async function mountTerminal(
	container: HTMLElement,
	options: MountTerminalOptions = {},
): Promise<() => void> {
	const { rows = 20, scrollback = 1000, welcomeMessage = DEFAULT_WELCOME } =
		options;

	const env: EmulatedEnvironment = await createEmulatedEnvironmentLazy({});
	const logger = createLogger({ mirrorToConsole: false });

	initTerminalManager({
		theme: getTheme,
		rows,
		scrollback,
	});

	let dispatcher: ReturnType<typeof createCommandDispatcher> | null = null;

	const attachId = attachTerminal({
		container,
		environment: env,
		welcomeMessage,
		onCommand(command: string) {
			if (!dispatcher) {
				const controller = getTerminalController();
				if (!controller) {
					return;
				}
				try {
					const fileSystem = createFileSystem(
						env.fileSystemState,
						env.eventBus,
						{ mutable: true },
					);
					dispatcher = createCommandDispatcher({
						fileSystem,
						renderer: controller.getRenderer(),
						shellContextStack: env.shellContextStack,
						clusterState: env.clusterState,
						eventBus: env.eventBus,
						logger,
					});
				} catch (err) {
					console.error("[Terminal] Failed to create dispatcher:", err);
					return;
				}
			}
			dispatcher.execute(command);
			getTerminalController()?.updatePrompt();
		},
	});

	const observer = new MutationObserver(() => updateTerminalTheme());
	observer.observe(document.documentElement, {
		attributes: true,
		attributeFilter: ["data-theme"],
	});

	return function cleanup() {
		observer.disconnect();
		detachTerminal(attachId);
		dispatcher = null;
		destroyEmulatedEnvironmentLazy(env);
	};
}
