#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// COURSE INDEXES SYNC
// ═══════════════════════════════════════════════════════════════════════════
// Synchronize course indexes from local files to Supabase database
// Uses Drizzle ORM with transactions for data integrity
//
// Usage:
//   npx tsx bin/sync-courses-db.ts           # Execute sync
//   npx tsx bin/sync-courses-db.ts --dry-run # Show plan without executing

import { readdir, readFile, stat } from 'fs/promises';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import postgres from 'postgres';
import * as schema from '../src/db/schema.js';

dotenv.config();

// ═══════════════════════════════════════════════════════════════════════════
// CLI ARGUMENTS
// ═══════════════════════════════════════════════════════════════════════════

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run') || args.includes('-n');

if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage: npx tsx bin/sync-courses-db.ts [options]

Options:
  --dry-run, -n   Show what would be changed without applying
  --debug         Show detailed diff for each change (use with --dry-run)
  --help, -h      Show this help message
`);
    process.exit(0);
}

// ═══════════════════════════════════════════════════════════════════════════
// PLAN TYPES (for dry-run mode)
// ═══════════════════════════════════════════════════════════════════════════

type ChangeAction = 'create' | 'update' | 'delete';

interface Change {
    action: ChangeAction;
    resource: string;
    id: string;
    details?: string;
}

interface Plan {
    courses: Change[];
    modules: Change[];
    chapters: Change[];
    lessons: Change[];
    courseChapters: Change[];
}

function createEmptyPlan(): Plan {
    return {
        courses: [],
        modules: [],
        chapters: [],
        lessons: [],
        courseChapters: [],
    };
}

// Global plan for dry-run mode
const plan = createEmptyPlan();

// Debug mode for showing what changed
const DEBUG_CHANGES = process.argv.includes('--debug');

// Normalize JSON by sorting keys recursively (for consistent comparison)
function sortKeys(obj: unknown): unknown {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }
    if (Array.isArray(obj)) {
        return obj.map(sortKeys);
    }
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(obj as Record<string, unknown>).sort()) {
        sorted[key] = sortKeys((obj as Record<string, unknown>)[key]);
    }
    return sorted;
}

// Helper to compare objects (ignoring timestamps and key order)
function hasChanges(existing: Record<string, unknown>, incoming: Record<string, unknown>, id?: string): boolean {
    const keysToCompare = Object.keys(incoming);
    const changedKeys: string[] = [];
    
    for (const key of keysToCompare) {
        // Normalize both values by sorting keys before comparing
        const existingVal = JSON.stringify(sortKeys(existing[key] ?? null));
        const incomingVal = JSON.stringify(sortKeys(incoming[key] ?? null));
        if (existingVal !== incomingVal) {
            changedKeys.push(key);
            if (DEBUG_CHANGES && id) {
                console.log(`\n[DEBUG] ${id} - field "${key}" differs:`);
                console.log(`  DB:   ${existingVal.slice(0, 100)}${existingVal.length > 100 ? '...' : ''}`);
                console.log(`  File: ${incomingVal.slice(0, 100)}${incomingVal.length > 100 ? '...' : ''}`);
            }
        }
    }
    return changedKeys.length > 0;
}

// ═══════════════════════════════════════════════════════════════════════════
// DATABASE SETUP
// ═══════════════════════════════════════════════════════════════════════════

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, '..');
const ROOT_DIR = resolve(__dirname, '..');
const COURSES_DIR = join(ROOT_DIR, 'src/courses');
const MODULES_DIR = join(COURSES_DIR, 'modules');

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
    console.error('❌ Missing DATABASE_URL environment variable');
    process.exit(1);
}

// Create postgres client and drizzle instance
const client = postgres(databaseUrl);
const db = drizzle(client, { schema });

// Type for transaction context
type Transaction = PostgresJsDatabase<typeof schema>;

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface CourseMetadata {
    title: { en: string; fr: string };
    description?: { en?: string; fr?: string };
    shortDescription?: { en?: string; fr?: string };
    isActive: boolean;
    price?: number | null;
    isFree?: boolean;
    comingSoon?: boolean;
    order?: number;
    level?: { en: string; fr: string };
}

interface CourseStructure {
    chapters: Array<{
        moduleId: string;
        chapterId: string | 'all';
        order?: number;
    }>;
}

interface ModuleMetadata {
    title: { en: string; fr: string };
    description?: { en?: string; fr?: string };
    tags?: string[];
}

interface ChapterMetadata {
    title: { en: string; fr: string };
    description?: { en?: string; fr?: string };
    isFree?: boolean;
    environment?: string;
}

interface LessonMetadata {
    draft?: boolean;
    title?: { en?: string; fr?: string };
}

interface Quiz {
    questions: Array<any>;
}

// ═══════════════════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

function extractIdFromFolderName(folderName: string): string {
    return folderName.replace(/^\d+-/, '');
}

function extractNumericPrefix(name: string): number {
    const match = name.match(/^(\d+)-/);
    return match ? parseInt(match[1], 10) : 999;
}

async function fileExists(filePath: string): Promise<boolean> {
    try {
        await stat(filePath);
        return true;
    } catch {
        return false;
    }
}

async function loadTypeScriptModule<T>(filePath: string): Promise<T> {
    const normalizedPath = filePath.replace(/\\/g, '/');
    const modulePath = normalizedPath.startsWith('/') 
        ? `file://${normalizedPath}`
        : `file:///${normalizedPath}`;
    const module = await import(modulePath);
    return module as T;
}

async function loadJSON<T>(filePath: string): Promise<T> {
    const content = await readFile(filePath, 'utf-8');
    return JSON.parse(content) as T;
}

// ═══════════════════════════════════════════════════════════════════════════
// SCANNING FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

async function scanCourses(): Promise<string[]> {
    const entries = await readdir(COURSES_DIR, { withFileTypes: true });
    return entries
        .filter(e => e.isDirectory() && e.name !== 'modules')
        .map(e => e.name)
        .sort();
}

async function scanModules(): Promise<string[]> {
    const entries = await readdir(MODULES_DIR, { withFileTypes: true });
    return entries
        .filter(e => e.isDirectory())
        .map(e => e.name)
        .sort();
}

async function scanModuleChapters(moduleId: string): Promise<string[]> {
    const moduleDir = join(MODULES_DIR, moduleId);
    const entries = await readdir(moduleDir, { withFileTypes: true });
    const chapters: string[] = [];
    
    for (const entry of entries) {
        if (entry.isDirectory() && await fileExists(join(moduleDir, entry.name, 'chapter.json'))) {
            chapters.push(entry.name);
        }
    }
    
    return chapters.sort((a, b) => extractNumericPrefix(a) - extractNumericPrefix(b));
}

async function scanChapterLessons(moduleId: string, chapterFolderName: string): Promise<string[]> {
    const chapterDir = join(MODULES_DIR, moduleId, chapterFolderName);
    const entries = await readdir(chapterDir, { withFileTypes: true });
    const lessonFolders: string[] = [];

    for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const lessonDir = join(chapterDir, entry.name);
        const enContent = join(lessonDir, 'en', 'content.md');
        const frContent = join(lessonDir, 'fr', 'content.md');
        
        const hasEn = await fileExists(enContent);
        const hasFr = await fileExists(frContent);
        if (hasEn || hasFr) {
            lessonFolders.push(entry.name);
        }
    }

    return lessonFolders.sort((a, b) => extractNumericPrefix(a) - extractNumericPrefix(b));
}

// ═══════════════════════════════════════════════════════════════════════════
// LOADING FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

async function loadCourseMetadata(courseId: string): Promise<CourseMetadata | null> {
    const courseFile = join(COURSES_DIR, courseId, 'course.ts');
    if (!(await fileExists(courseFile))) return null;

    try {
        const module = await loadTypeScriptModule<{ course: CourseMetadata }>(courseFile);
        return module.course;
    } catch (err) {
        console.error(`Failed to load course metadata for ${courseId}:`, err);
        return null;
    }
}

async function loadCourseStructure(courseId: string): Promise<CourseStructure | null> {
    const structureFile = join(COURSES_DIR, courseId, 'course-structure.ts');
    if (!(await fileExists(structureFile))) return null;

    try {
        const module = await loadTypeScriptModule<{ courseStructure: CourseStructure }>(structureFile);
        return module.courseStructure;
    } catch (err) {
        console.error(`Failed to load course structure for ${courseId}:`, err);
        return null;
    }
}

async function loadModuleMetadata(moduleId: string): Promise<ModuleMetadata | null> {
    const moduleFile = join(MODULES_DIR, moduleId, 'module.ts');
    if (!(await fileExists(moduleFile))) return null;

    try {
        const module = await loadTypeScriptModule<{ module: ModuleMetadata }>(moduleFile);
        return module.module;
    } catch (err) {
        console.error(`Failed to load module metadata for ${moduleId}:`, err);
        return null;
    }
}

async function loadChapterMetadata(moduleId: string, chapterFolderName: string): Promise<ChapterMetadata | null> {
    const chapterFile = join(MODULES_DIR, moduleId, chapterFolderName, 'chapter.json');
    if (!(await fileExists(chapterFile))) return null;

    try {
        return await loadJSON<ChapterMetadata>(chapterFile);
    } catch (err) {
        console.error(`Failed to load chapter metadata for ${moduleId}/${chapterFolderName}:`, err);
        return null;
    }
}

async function loadLessonContent(moduleId: string, chapterFolderName: string, lessonFolderName: string, locale: 'en' | 'fr'): Promise<string | null> {
    const contentFile = join(MODULES_DIR, moduleId, chapterFolderName, lessonFolderName, locale, 'content.md');
    if (!(await fileExists(contentFile))) return null;

    try {
        return await readFile(contentFile, 'utf-8');
    } catch (err) {
        console.error(`Failed to load lesson content for ${moduleId}/${chapterFolderName}/${lessonFolderName}/${locale}:`, err);
        return null;
    }
}

async function loadLessonQuiz(moduleId: string, chapterFolderName: string, lessonFolderName: string, locale: 'en' | 'fr'): Promise<Quiz | null> {
    const quizFile = join(MODULES_DIR, moduleId, chapterFolderName, lessonFolderName, locale, 'quiz.ts');
    if (!(await fileExists(quizFile))) return null;

    try {
        const module = await loadTypeScriptModule<{ quiz: Quiz }>(quizFile);
        return module.quiz;
    } catch (err) {
        console.error(`Failed to load lesson quiz for ${moduleId}/${chapterFolderName}/${lessonFolderName}/${locale}:`, err);
        return null;
    }
}

async function getLessonTitle(moduleId: string, chapterFolderName: string, lessonFolderName: string, locale: 'en' | 'fr'): Promise<string> {
    const content = await loadLessonContent(moduleId, chapterFolderName, lessonFolderName, locale);
    if (content) {
        const h1Match = content.match(/^#\s+(.+)$/m);
        if (h1Match) {
            return h1Match[1].trim();
        }
    }
    return extractIdFromFolderName(lessonFolderName);
}

// ═══════════════════════════════════════════════════════════════════════════
// SYNC FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

async function syncCourses(tx: Transaction) {
    console.log('📚 Scanning courses...');
    const courseFolders = await scanCourses();
    const courseIds: string[] = [];

    // Get existing courses from DB with all fields
    const existingCourses = await tx.select().from(schema.courses);
    const existingById = new Map(existingCourses.map(c => [c.id, c]));

    for (const courseId of courseFolders) {
        const metadata = await loadCourseMetadata(courseId);
        if (!metadata || !metadata.isActive) continue;

        const existing = existingById.get(courseId);
        const incoming = {
            title: metadata.title,
            description: metadata.description || null,
            shortDescription: metadata.shortDescription || null,
            level: metadata.level || null,
            isFree: metadata.isFree ?? false,
            comingSoon: metadata.comingSoon ?? false,
            orderIndex: metadata.order ?? null,
            price: metadata.price ?? null,
            isActive: true,
        };

        if (DRY_RUN) {
            if (!existing) {
                plan.courses.push({ action: 'create', resource: 'course', id: courseId, details: metadata.title.en });
            } else if (hasChanges(existing as unknown as Record<string, unknown>, incoming, courseId)) {
                plan.courses.push({ action: 'update', resource: 'course', id: courseId, details: metadata.title.en });
            }
            // If no changes, don't add to plan
        } else {
            await tx
                .insert(schema.courses)
                .values({
                    id: courseId,
                    title: metadata.title,
                    description: metadata.description || null,
                    shortDescription: metadata.shortDescription || null,
                    level: metadata.level || null,
                    isFree: metadata.isFree ?? false,
                    comingSoon: metadata.comingSoon ?? false,
                    orderIndex: metadata.order ?? null,
                    price: metadata.price ?? null,
                    isActive: true,
                    updatedAt: new Date(),
                })
                .onConflictDoUpdate({
                    target: schema.courses.id,
                    set: {
                        title: metadata.title,
                        description: metadata.description || null,
                        shortDescription: metadata.shortDescription || null,
                        level: metadata.level || null,
                        isFree: metadata.isFree ?? false,
                        comingSoon: metadata.comingSoon ?? false,
                        orderIndex: metadata.order ?? null,
                        price: metadata.price ?? null,
                        isActive: true,
                        updatedAt: new Date(),
                    },
                });
            console.log(`  ✓ ${courseId}`);
        }

        courseIds.push(courseId);
    }

    return courseIds;
}

async function syncModules(tx: Transaction) {
    console.log('📦 Scanning modules...');
    const moduleFolders = await scanModules();
    const moduleIds: string[] = [];

    // Get existing modules from DB with all fields
    const existingModules = await tx.select().from(schema.modules);
    const existingById = new Map(existingModules.map(m => [m.id, m]));

    for (const moduleId of moduleFolders) {
        const metadata = await loadModuleMetadata(moduleId);
        if (!metadata) continue;

        const existing = existingById.get(moduleId);
        const incoming = {
            title: metadata.title,
            description: metadata.description || null,
            tags: metadata.tags || null,
        };

        if (DRY_RUN) {
            if (!existing) {
                plan.modules.push({ action: 'create', resource: 'module', id: moduleId, details: metadata.title.en });
            } else if (hasChanges(existing as unknown as Record<string, unknown>, incoming, moduleId)) {
                plan.modules.push({ action: 'update', resource: 'module', id: moduleId, details: metadata.title.en });
            }
        } else {
            await tx
                .insert(schema.modules)
                .values({
                    id: moduleId,
                    title: metadata.title,
                    description: metadata.description || null,
                    tags: metadata.tags || null,
                    updatedAt: new Date(),
                })
                .onConflictDoUpdate({
                    target: schema.modules.id,
                    set: {
                        title: metadata.title,
                        description: metadata.description || null,
                        tags: metadata.tags || null,
                        updatedAt: new Date(),
                    },
                });
            console.log(`  ✓ ${moduleId}`);
        }

        moduleIds.push(moduleId);
    }

    return moduleIds;
}

async function syncChapters(tx: Transaction, moduleIds: string[]) {
    console.log('📖 Scanning chapters...');
    const chapterKeys: string[] = [];

    // Get existing chapters from DB with all fields
    const existingChapters = await tx.select().from(schema.chapters);
    const existingById = new Map(existingChapters.map(c => [c.id, c]));

    for (const moduleId of moduleIds) {
        const chapterFolders = await scanModuleChapters(moduleId);

        for (let chapterIndex = 0; chapterIndex < chapterFolders.length; chapterIndex++) {
            const chapterFolderName = chapterFolders[chapterIndex];
            const metadata = await loadChapterMetadata(moduleId, chapterFolderName);
            if (!metadata) continue;

            const chapterId = extractIdFromFolderName(chapterFolderName);
            const existing = existingById.get(chapterId);
            const incoming = {
                moduleId: moduleId,
                title: metadata.title,
                description: metadata.description || null,
                isFree: metadata.isFree ?? false,
                environment: metadata.environment || 'empty',
                orderIndex: chapterIndex,
            };

            if (DRY_RUN) {
                if (!existing) {
                    plan.chapters.push({ action: 'create', resource: 'chapter', id: `${moduleId}/${chapterId}`, details: metadata.title.en });
                } else if (hasChanges(existing as unknown as Record<string, unknown>, incoming, `${moduleId}/${chapterId}`)) {
                    plan.chapters.push({ action: 'update', resource: 'chapter', id: `${moduleId}/${chapterId}`, details: metadata.title.en });
                }
            } else {
                await tx
                    .insert(schema.chapters)
                    .values({
                        id: chapterId,
                        moduleId: moduleId,
                        title: metadata.title,
                        description: metadata.description || null,
                        isFree: metadata.isFree ?? false,
                        environment: metadata.environment || 'empty',
                        orderIndex: chapterIndex,
                        updatedAt: new Date(),
                    })
                    .onConflictDoUpdate({
                        target: schema.chapters.id,
                        set: {
                            moduleId: moduleId,
                            title: metadata.title,
                            description: metadata.description || null,
                            isFree: metadata.isFree ?? false,
                            environment: metadata.environment || 'empty',
                            orderIndex: chapterIndex,
                            updatedAt: new Date(),
                        },
                    });
                console.log(`  ✓ ${moduleId}/${chapterId}`);
            }

            chapterKeys.push(`${moduleId}:${chapterId}`);
        }
    }

    return chapterKeys;
}

async function syncLessons(tx: Transaction, moduleIds: string[]) {
    console.log('📝 Scanning lessons...');
    const lessonKeys: string[] = [];

    // Get existing lessons from DB with all fields
    const existingLessons = await tx.select().from(schema.lessons);
    const existingById = new Map(existingLessons.map(l => [l.id, l]));

    for (const moduleId of moduleIds) {
        const chapterFolders = await scanModuleChapters(moduleId);

        for (const chapterFolderName of chapterFolders) {
            const chapterId = extractIdFromFolderName(chapterFolderName);
            const lessonFolders = await scanChapterLessons(moduleId, chapterFolderName);

            for (let lessonIndex = 0; lessonIndex < lessonFolders.length; lessonIndex++) {
                const lessonFolderName = lessonFolders[lessonIndex];
                const lessonId = extractIdFromFolderName(lessonFolderName);

                // Load content and quiz for both locales
                const [enContent, frContent, enQuiz, frQuiz] = await Promise.all([
                    loadLessonContent(moduleId, chapterFolderName, lessonFolderName, 'en'),
                    loadLessonContent(moduleId, chapterFolderName, lessonFolderName, 'fr'),
                    loadLessonQuiz(moduleId, chapterFolderName, lessonFolderName, 'en'),
                    loadLessonQuiz(moduleId, chapterFolderName, lessonFolderName, 'fr'),
                ]);

                // Get titles
                const enTitle = await getLessonTitle(moduleId, chapterFolderName, lessonFolderName, 'en');
                const frTitle = await getLessonTitle(moduleId, chapterFolderName, lessonFolderName, 'fr');

                // Build content and quiz objects
                const content: Record<string, string> = {};
                if (enContent) content.en = enContent;
                if (frContent) content.fr = frContent;

                const quiz: Record<string, unknown> = {};
                if (enQuiz) quiz.en = JSON.parse(JSON.stringify(enQuiz));
                if (frQuiz) quiz.fr = JSON.parse(JSON.stringify(frQuiz));

                const existing = existingById.get(lessonId);
                const incoming = {
                    moduleId: moduleId,
                    chapterId: chapterId,
                    title: { en: enTitle, fr: frTitle },
                    content: Object.keys(content).length > 0 ? content : {},
                    quiz: Object.keys(quiz).length > 0 ? quiz : null,
                    hasEnvironment: true,
                    orderIndex: lessonIndex,
                };

                if (DRY_RUN) {
                    if (!existing) {
                        plan.lessons.push({ action: 'create', resource: 'lesson', id: `${moduleId}/${chapterId}/${lessonId}`, details: enTitle });
                    } else if (hasChanges(existing as unknown as Record<string, unknown>, incoming, `${moduleId}/${chapterId}/${lessonId}`)) {
                        plan.lessons.push({ action: 'update', resource: 'lesson', id: `${moduleId}/${chapterId}/${lessonId}`, details: enTitle });
                    }
                } else {
                    await tx
                        .insert(schema.lessons)
                        .values({
                            id: lessonId,
                            moduleId: moduleId,
                            chapterId: chapterId,
                            title: { en: enTitle, fr: frTitle },
                            content: Object.keys(content).length > 0 ? content : {},
                            quiz: Object.keys(quiz).length > 0 ? quiz : null,
                            hasEnvironment: true,
                            orderIndex: lessonIndex,
                            updatedAt: new Date(),
                        })
                        .onConflictDoUpdate({
                            target: schema.lessons.id,
                            set: {
                                moduleId: moduleId,
                                chapterId: chapterId,
                                title: { en: enTitle, fr: frTitle },
                                content: Object.keys(content).length > 0 ? content : {},
                                quiz: Object.keys(quiz).length > 0 ? quiz : null,
                                hasEnvironment: true,
                                orderIndex: lessonIndex,
                                updatedAt: new Date(),
                            },
                        });
                }

                lessonKeys.push(`${moduleId}:${chapterId}:${lessonId}`);
            }
        }
    }

    if (!DRY_RUN) {
        console.log(`  ✓ Synced ${lessonKeys.length} lessons`);
    }
    return lessonKeys;
}

async function syncCourseChapters(tx: Transaction, courseIds: string[], syncedChapterKeys: string[]) {
    console.log('🔗 Scanning course chapters...');
    let count = 0;

    // Convert synced chapter keys to a Set for fast lookup
    const syncedChapters = new Set(syncedChapterKeys);

    // Get existing course chapters to determine deletes
    const existingCourseChapters = await tx
        .select({
            courseId: schema.courseChapters.courseId,
            chapterId: schema.courseChapters.chapterId,
        })
        .from(schema.courseChapters);
    
    const existingByCoursue = new Map<string, Set<string>>();
    for (const cc of existingCourseChapters) {
        if (!existingByCoursue.has(cc.courseId)) {
            existingByCoursue.set(cc.courseId, new Set());
        }
        existingByCoursue.get(cc.courseId)!.add(cc.chapterId);
    }

    for (const courseId of courseIds) {
        const structure = await loadCourseStructure(courseId);
        if (!structure) continue;

        const existingForCourse = existingByCoursue.get(courseId) || new Set();
        const newChapterIds = new Set<string>();

        // First pass: collect what chapters will be in this course
        for (let index = 0; index < structure.chapters.length; index++) {
            const chapterRef = structure.chapters[index];
            let chapterIds: string[] = [];

            if (chapterRef.chapterId === 'all') {
                const chapterFolders = await scanModuleChapters(chapterRef.moduleId);
                chapterIds = chapterFolders.map(f => extractIdFromFolderName(f));
            } else {
                chapterIds = [extractIdFromFolderName(chapterRef.chapterId)];
            }

            for (const chapterId of chapterIds) {
                const chapterKey = `${chapterRef.moduleId}:${chapterId}`;
                if (syncedChapters.has(chapterKey)) {
                    newChapterIds.add(chapterId);
                }
            }
        }

        // In dry-run: show deletes (chapters in DB but not in new structure)
        if (DRY_RUN) {
            for (const existingChapterId of existingForCourse) {
                if (!newChapterIds.has(existingChapterId)) {
                    plan.courseChapters.push({
                        action: 'delete',
                        resource: 'course_chapter',
                        id: `${courseId} → ${existingChapterId}`,
                    });
                }
            }
        } else {
            // Delete existing course chapters for this course
            await tx
                .delete(schema.courseChapters)
                .where(eq(schema.courseChapters.courseId, courseId));
        }

        // Second pass: create new relations
        for (let index = 0; index < structure.chapters.length; index++) {
            const chapterRef = structure.chapters[index];
            let chapterIds: string[] = [];

            if (chapterRef.chapterId === 'all') {
                const chapterFolders = await scanModuleChapters(chapterRef.moduleId);
                chapterIds = chapterFolders.map(f => extractIdFromFolderName(f));
            } else {
                chapterIds = [extractIdFromFolderName(chapterRef.chapterId)];
            }

            for (const chapterId of chapterIds) {
                const chapterKey = `${chapterRef.moduleId}:${chapterId}`;
                if (!syncedChapters.has(chapterKey)) {
                    continue;
                }

                if (DRY_RUN) {
                    // Only show as "create" if it's a new relation (not already in DB)
                    if (!existingForCourse.has(chapterId)) {
                        plan.courseChapters.push({
                            action: 'create',
                            resource: 'course_chapter',
                            id: `${courseId} → ${chapterId}`,
                        });
                    }
                    // If already exists, it's unchanged - don't add to plan
                } else {
                    await tx
                        .insert(schema.courseChapters)
                        .values({
                            courseId: courseId,
                            moduleId: chapterRef.moduleId,
                            chapterId: chapterId,
                            orderIndex: chapterRef.order ?? index,
                            updatedAt: new Date(),
                        });
                }

                count++;
            }
        }
    }

    if (!DRY_RUN) {
        console.log(`  ✓ Synced ${count} course chapter relations`);
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// PLAN DISPLAY
// ═══════════════════════════════════════════════════════════════════════════

const COLORS = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    cyan: '\x1b[36m',
    dim: '\x1b[2m',
};

function getActionSymbol(action: ChangeAction): string {
    switch (action) {
        case 'create': return `${COLORS.green}+${COLORS.reset}`;
        case 'update': return `${COLORS.yellow}~${COLORS.reset}`;
        case 'delete': return `${COLORS.red}-${COLORS.reset}`;
    }
}

function getActionColor(action: ChangeAction): string {
    switch (action) {
        case 'create': return COLORS.green;
        case 'update': return COLORS.yellow;
        case 'delete': return COLORS.red;
    }
}

function printPlan() {
    console.log('\n' + '═'.repeat(70));
    console.log(`${COLORS.cyan}PLAN: Course Sync Changes${COLORS.reset}`);
    console.log('═'.repeat(70) + '\n');

    const allChanges = [
        ...plan.courses,
        ...plan.modules,
        ...plan.chapters,
        ...plan.lessons,
        ...plan.courseChapters,
    ];

    if (allChanges.length === 0) {
        console.log('No changes detected. Database is up to date.\n');
        return;
    }

    // Group by resource type
    const sections = [
        { name: 'Courses', changes: plan.courses },
        { name: 'Modules', changes: plan.modules },
        { name: 'Chapters', changes: plan.chapters },
        { name: 'Lessons', changes: plan.lessons },
        { name: 'Course-Chapter Relations', changes: plan.courseChapters },
    ];

    for (const section of sections) {
        if (section.changes.length === 0) continue;

        console.log(`${COLORS.cyan}${section.name}:${COLORS.reset}`);
        for (const change of section.changes) {
            const symbol = getActionSymbol(change.action);
            const color = getActionColor(change.action);
            const details = change.details ? ` ${COLORS.dim}(${change.details})${COLORS.reset}` : '';
            console.log(`  ${symbol} ${color}${change.id}${COLORS.reset}${details}`);
        }
        console.log();
    }

    // Summary
    const creates = allChanges.filter(c => c.action === 'create').length;
    const updates = allChanges.filter(c => c.action === 'update').length;
    const deletes = allChanges.filter(c => c.action === 'delete').length;

    console.log('─'.repeat(70));
    console.log(`Plan: ${COLORS.green}${creates} to create${COLORS.reset}, ${COLORS.yellow}${updates} to update${COLORS.reset}, ${COLORS.red}${deletes} to delete${COLORS.reset}`);
    console.log('─'.repeat(70));
    console.log(`\n${COLORS.dim}Run without --dry-run to apply these changes.${COLORS.reset}\n`);
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
    if (DRY_RUN) {
        console.log('🔍 DRY RUN MODE - No changes will be made\n');
    } else {
        console.log('🚀 Starting course indexes synchronization...\n');
    }

    try {
        await db.transaction(async (tx) => {
            const courseIds = await syncCourses(tx);
            const moduleIds = await syncModules(tx);
            const chapterKeys = await syncChapters(tx, moduleIds);
            await syncLessons(tx, moduleIds);
            await syncCourseChapters(tx, courseIds, chapterKeys);

            // In dry-run mode, rollback by throwing (but handled gracefully)
            if (DRY_RUN) {
                throw new Error('DRY_RUN_ROLLBACK');
            }
        });

        console.log('\n✅ Synchronization completed successfully!');
    } catch (err) {
        if (err instanceof Error && err.message === 'DRY_RUN_ROLLBACK') {
            // Expected in dry-run mode, print the plan
            printPlan();
        } else {
            console.error('\n❌ Synchronization failed (transaction rolled back):', err);
            process.exit(1);
        }
    } finally {
        await client.end();
    }
}

main();
