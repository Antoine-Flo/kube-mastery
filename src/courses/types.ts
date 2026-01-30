export interface LocalModule {
    title: { en: string; fr: string };
    description?: { en?: string; fr?: string };
    tags?: string[];
}

export interface CourseStructure {
    chapters: Array<{
        moduleId: string;
        chapterId: string | 'all'; // 'all' = tous les chapitres du module
        order?: number; // Optionnel pour réordonner dans le cours
    }>;
}

export interface LocalCourse {
    title: {
        en: string;
        fr: string;
    };
    description?: {
        en?: string;
        fr?: string;
    };
    shortDescription?: {
        en?: string;
        fr?: string;
    };
    isActive: boolean;
    price?: number | null; // null or undefined = free, number = price in euros
    isFree?: boolean; // true if the course is free (for badge display)
    comingSoon?: boolean; // true if the course is not yet available
    order?: number; // display order on courses page (lower = first)
    level?: {
        en: string;
        fr: string;
    };
}