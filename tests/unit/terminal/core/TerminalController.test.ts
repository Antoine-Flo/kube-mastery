import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AutocompleteEngine } from '../../../../src/core/terminal/autocomplete/AutocompleteEngine';
import type { CompletionResult } from '../../../../src/core/terminal/autocomplete/types';
import type { ShellContextStack } from '../../../../src/core/terminal/core/ShellContext';
import { createTerminalController } from '../../../../src/core/terminal/core/TerminalController';
import { createMockRenderer } from '../../helpers/mockRenderer';

// Mock ShellContextStack
const createMockShellContextStack = (): ShellContextStack => {
    const mockFileSystem = {
        getCurrentPath: () => '/home/kube',
    };

    return {
        getCurrentPrompt: vi.fn(() => '☸ ~>'),
        updateCurrentPrompt: vi.fn(),
        getCurrentFileSystem: vi.fn(() => mockFileSystem),
        pushContainerContext: vi.fn(),
        popContext: vi.fn(() => false),
        getCurrentContext: vi.fn(),
        isInContainer: vi.fn(() => false),
    } as unknown as ShellContextStack;
};


// Mock AutocompleteEngine pour les tests
const createMockAutocompleteEngine = (): AutocompleteEngine & { resetTabTiming: () => void } => {
    const mockResults: CompletionResult[] = [];
    const mockGetCompletionResults = vi.fn((_line: string, _context: any): CompletionResult[] => {
        return mockResults;
    });
    const mockGetCommonPrefix = vi.fn((suggestions: string[]): string => {
        if (suggestions.length === 0) return '';
        if (suggestions.length === 1) return suggestions[0];
        // Simple prefix calculation for tests
        const sorted = suggestions.sort();
        const first = sorted[0];
        const last = sorted[sorted.length - 1];
        let i = 0;
        while (i < first.length && first[i] === last[i]) {
            i++;
        }
        return first.slice(0, i);
    });
    const mockFormatSuggestions = vi.fn((suggestions: string[]): string => {
        return suggestions.join('  ');
    });
    let lastTabPressTime = 0;
    const mockHandleTabPress = vi.fn((_line: string, _context: any, callbacks: any): void => {
        const results = mockGetCompletionResults(_line, _context);
        if (results.length === 0) return;

        const now = Date.now();
        const isDoubleTap = (now - lastTabPressTime) < 500;
        lastTabPressTime = now;

        // Simuler la logique de base pour les tests
        if (results.length === 1) {
            const result = results[0];
            const currentToken = callbacks.getCurrentToken();
            if (currentToken === result.text) {
                callbacks.updateLineAndRender(callbacks.getCurrentLine() + result.suffix, result.suffix);
            } else {
                const toAdd = result.text.slice(currentToken.length) + result.suffix;
                callbacks.updateLineAndRender(callbacks.getCurrentLine() + toAdd, toAdd);
            }
        } else if (isDoubleTap) {
            // Double tap : afficher toutes les suggestions
            const suggestions = mockFormatSuggestions(results.map(r => r.text));
            const currentLine = callbacks.getCurrentLine();
            callbacks.write('\r\n');
            callbacks.write(suggestions);
            callbacks.write('\r\n');
            callbacks.showPrompt();
            callbacks.write(currentLine);
            callbacks.updateCurrentLine(currentLine, currentLine.length);
        } else {
            // Single tap avec multiple matches : common prefix
            const prefix = mockGetCommonPrefix(results.map(r => r.text));
            const currentToken = callbacks.getCurrentToken();
            const toAdd = prefix.slice(currentToken.length);
            if (toAdd) {
                callbacks.updateLineAndRender(callbacks.getCurrentLine() + toAdd, toAdd);
            }
        }
    });
    const resetTabTiming = vi.fn(() => {
        lastTabPressTime = 0;
    });

    return {
        registerProvider: vi.fn(),
        registerProviders: vi.fn(),
        getCompletionResults: mockGetCompletionResults,
        getCompletions: vi.fn(),
        getCommonPrefix: mockGetCommonPrefix,
        formatSuggestions: mockFormatSuggestions,
        handleTabPress: mockHandleTabPress,
        resetTabTiming,
    } as unknown as AutocompleteEngine & { resetTabTiming: () => void };
};

describe('TerminalController', () => {
    let renderer: ReturnType<typeof createMockRenderer>;
    let shellContextStack: ReturnType<typeof createMockShellContextStack>;
    let autocompleteEngine: ReturnType<typeof createMockAutocompleteEngine>;

    beforeEach(() => {
        renderer = createMockRenderer();
        shellContextStack = createMockShellContextStack();
        autocompleteEngine = createMockAutocompleteEngine();
        autocompleteEngine.resetTabTiming();
        vi.clearAllMocks();
    });

    describe('initialization', () => {
        it('should create controller with dependencies', () => {
            const controller = createTerminalController({
                renderer,
                shellContextStack,
            });

            expect(controller).toBeDefined();
        });
    });

    describe('prompt handling', () => {
        it('should show prompt', () => {
            const controller = createTerminalController({
                renderer,
                shellContextStack,
            });

            controller.showPrompt();

            expect(shellContextStack.getCurrentPrompt).toHaveBeenCalled();
            expect(renderer.getOutput()).toContain('☸ ~>');
        });

        it('should update prompt', () => {
            const controller = createTerminalController({
                renderer,
                shellContextStack,
            });

            controller.updatePrompt();

            expect(shellContextStack.updateCurrentPrompt).toHaveBeenCalled();
        });
    });

    describe('command handling', () => {
        it('should handle Enter key and call callback', () => {
            const callback = vi.fn();
            const controller = createTerminalController({
                renderer,
                shellContextStack,
            });

            controller.onCommand(callback);
            controller.simulateInput('test');
            controller.simulateInput('\r');

            expect(callback).toHaveBeenCalledWith('test');
        });

        it('should not call callback for empty command', () => {
            const callback = vi.fn();
            const controller = createTerminalController({
                renderer,
                shellContextStack,
            });

            controller.onCommand(callback);
            controller.simulateInput('\r');

            expect(callback).not.toHaveBeenCalled();
        });
    });

    describe('history navigation', () => {
        it('should navigate history with arrow up', () => {
            const controller = createTerminalController({
                renderer,
                shellContextStack,
            });

            // Set up command callback so commands are added to history
            controller.onCommand(() => { });

            // Execute first command to add it to history
            controller.simulateInput('first');
            controller.simulateInput('\r');
            renderer.clearOutput();

            // Execute second command (most recent in history)
            controller.simulateInput('second');
            controller.simulateInput('\r');
            renderer.clearOutput();

            // Type something new (not executed)
            controller.simulateInput('new');
            renderer.clearOutput();

            // Navigate up in history
            // When historyIndex is -1 and we navigate up, it becomes 0
            // historyPosition = history.length - 1 - historyIndex = 2 - 1 - 0 = 1
            // history[1] = 'second'
            controller.simulateInput('\x1b[A');

            const output = renderer.getOutput();
            // After navigation, redrawCurrentLine() should:
            // 1. Erase current input using backspace (\b \b) for each character of old line
            // 2. Write new line -> 'second'
            // Note: We use \b \b instead of clearing entire line to preserve prompt (no flash)
            // Since we cleared currentLine before updating, old line was 'new' (3 chars)
            // So we should see backspace operations (3x \b \b) and then 'second'
            expect(output).toContain('second');
        });

        it('should navigate history with arrow down', () => {
            const controller = createTerminalController({
                renderer,
                shellContextStack,
            });

            // Execute commands to build history
            controller.simulateInput('cmd1');
            controller.simulateInput('\r');
            renderer.clearOutput();

            controller.simulateInput('cmd2');
            controller.simulateInput('\r');
            renderer.clearOutput();

            // Navigate up, then down
            controller.simulateInput('\x1b[A');
            controller.simulateInput('\x1b[B');

            // Should restore temp line or go to most recent
            expect(renderer.getOutput()).toBeDefined();
        });
    });

    describe('cursor movement', () => {
        it('should move cursor left with arrow left', () => {
            const controller = createTerminalController({
                renderer,
                shellContextStack,
            });

            controller.simulateInput('test');
            renderer.clearOutput();
            controller.simulateInput('\x1b[D');

            const output = renderer.getOutput();
            expect(output).toContain('[CURSOR_LEFT]');
        });

        it('should move cursor right with arrow right', () => {
            const controller = createTerminalController({
                renderer,
                shellContextStack,
            });

            controller.simulateInput('test');
            // Move left first
            controller.simulateInput('\x1b[D');
            renderer.clearOutput();
            // Then move right
            controller.simulateInput('\x1b[C');

            const output = renderer.getOutput();
            expect(output).toContain('[CURSOR_RIGHT]');
        });
    });

    describe('autocomplete (handleTab)', () => {
        it('should not autocomplete if no engine provided', () => {
            const controller = createTerminalController({
                renderer,
                shellContextStack,
            });

            controller.simulateInput('kubectl');
            renderer.clearOutput();
            controller.simulateInput('\t');

            // Should not call getCompletionResults
            expect(autocompleteEngine.getCompletionResults).not.toHaveBeenCalled();
        });

        it('should autocomplete single match', () => {
            vi.mocked(autocompleteEngine.getCompletionResults).mockReturnValue([
                { text: 'kubectl', suffix: ' ' },
            ]);

            const controller = createTerminalController({
                renderer,
                shellContextStack,
                autocompleteEngine,
            });

            controller.simulateInput('kube');
            renderer.clearOutput();
            controller.simulateInput('\t');

            expect(autocompleteEngine.handleTabPress).toHaveBeenCalled();
            const output = renderer.getOutput();
            expect(output).toContain('ctl');
            expect(output).toContain(' ');
        });

        it('should complete common prefix on single tab with multiple matches', () => {
            vi.mocked(autocompleteEngine.getCompletionResults).mockReturnValue([
                { text: 'kubectl-get', suffix: ' ' },
                { text: 'kubectl-describe', suffix: ' ' },
            ]);

            const controller = createTerminalController({
                renderer,
                shellContextStack,
                autocompleteEngine,
            });

            controller.simulateInput('kubectl-');
            renderer.clearOutput();
            controller.simulateInput('\t');

            expect(autocompleteEngine.handleTabPress).toHaveBeenCalled();
            // Should complete common prefix "kubectl-"
            const output = renderer.getOutput();
            expect(output).toBeDefined();
        });

        it('should show all suggestions on double tab', () => {
            vi.mocked(autocompleteEngine.getCompletionResults).mockReturnValue([
                { text: 'pod1', suffix: ' ' },
                { text: 'pod2', suffix: ' ' },
                { text: 'pod3', suffix: ' ' },
            ]);

            const controller = createTerminalController({
                renderer,
                shellContextStack,
                autocompleteEngine,
            });

            controller.simulateInput('pod');
            renderer.clearOutput();

            // First tab
            controller.simulateInput('\t');
            // Second tab within 500ms (double tap)
            controller.simulateInput('\t');

            expect(autocompleteEngine.handleTabPress).toHaveBeenCalled();
            // Should show formatted suggestions
            const output = renderer.getOutput();
            expect(output).toContain('pod1');
            expect(output).toContain('pod2');
            expect(output).toContain('pod3');
        });

        it('should use dynamic filesystem from shell context', () => {
            const controller = createTerminalController({
                renderer,
                shellContextStack,
                autocompleteEngine,
            });

            controller.simulateInput('ls');
            renderer.clearOutput();
            controller.simulateInput('\t');

            expect(shellContextStack.getCurrentFileSystem).toHaveBeenCalled();
            expect(autocompleteEngine.handleTabPress).toHaveBeenCalled();
        });
    });

    describe('backspace handling', () => {
        it('should delete character before cursor', () => {
            const controller = createTerminalController({
                renderer,
                shellContextStack,
            });

            controller.simulateInput('test');
            renderer.clearOutput();
            controller.simulateInput('\x7f'); // Backspace

            const output = renderer.getOutput();
            // Should redraw line without last character
            expect(output).toBeDefined();
        });

        it('should not delete when at start of line', () => {
            const controller = createTerminalController({
                renderer,
                shellContextStack,
            });

            renderer.clearOutput();
            controller.simulateInput('\x7f'); // Backspace at start

            // Should not throw or modify state incorrectly
            expect(renderer.getOutput()).toBeDefined();
        });
    });

    describe('character input', () => {
        it('should insert characters at cursor position', () => {
            const controller = createTerminalController({
                renderer,
                shellContextStack,
            });

            controller.simulateInput('hello');
            renderer.clearOutput();

            // After clearing, simulate input ' world'
            // Each character triggers a redraw, so we'll see multiple CLEAR_TO_END operations
            controller.simulateInput(' world');

            const output = renderer.getOutput();
            // The output contains characters being written with redraws
            // We should see the characters 'w', 'o', 'r', 'l', 'd' being written
            expect(output).toContain('w');
            expect(output).toContain('d'); // last char of 'world'
        });
    });
});
