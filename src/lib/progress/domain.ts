import type { ProgressForLearnable } from "./types";

/**
 * Compute progress for a single learnable (ordered lesson IDs).
 * currentLessonId = first incomplete lesson, or last lesson if all completed.
 */
export function computeProgress(
	lessonIds: string[],
	completed: Set<string>,
): ProgressForLearnable {
	const total = lessonIds.length;
	if (total === 0) {
		return { percentage: 0, hasStarted: false, currentLessonId: null };
	}

	const completedCount = lessonIds.filter((id) => completed.has(id)).length;
	const hasStarted = completedCount > 0;
	const percentage = Math.round((completedCount / total) * 100);
	const firstIncomplete = lessonIds.find((id) => !completed.has(id));
	const currentLessonId =
		firstIncomplete ?? lessonIds[lessonIds.length - 1] ?? null;

	return { percentage, hasStarted, currentLessonId };
}

/**
 * Compute progress for multiple learnables.
 */
export function computeProgressMap(
	learnables: { id: string; lessonIds: string[] }[],
	completed: Set<string>,
): Map<string, ProgressForLearnable> {
	const map = new Map<string, ProgressForLearnable>();
	for (const { id, lessonIds } of learnables) {
		map.set(id, computeProgress(lessonIds, completed));
	}
	return map;
}
