export interface ProgressForLearnable {
	percentage: number;
	hasStarted: boolean;
	currentLessonId: string | null;
}

export interface ProgressContext {
	completed: Set<string>;
	userId?: string;
}
