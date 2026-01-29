#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// GOLDEN FILES GENERATOR
// ═══════════════════════════════════════════════════════════════════════════
// Generate golden files for kubectl command conformance testing

import { Command } from 'commander'
import { applyYamlFiles, deleteAllClusters, deleteCluster, ensureCluster, getSeedPath, switchContext, waitForPodsReady } from './modules/cluster-manager'
import { runKubectlCommand } from './modules/command-runner'
import { writeGoldenFile } from './modules/file-writer'
import { normalizeOutput } from './modules/normalizer'
import { GOLDEN_TESTS, type GoldenTest, type GoldenTestCategory } from './config/golden-tests'
import type { Result } from './utils/types'

// ─── CLI Setup ─────────────────────────────────────────────────────────────

const program = new Command()

program
    .name('golden-generate')
    .description('Generate golden files for kubectl conformance tests')
    .version('1.0.0')
    .option('-t, --test <name>', 'Filter by test name')
    .option('-c, --category <name>', 'Filter by category (pods, events, version, cluster-info, api-resources, configmaps, secrets, describe, nodes)')
    .option('--clean', 'Delete all clusters and exit (no generation)')
    .option('--list', 'List all available tests')
    .action(async (options) => {
        await main(options)
    })

// ─── Helper Functions ──────────────────────────────────────────────────────

/**
 * Type guard to check if a Result is an error
 */
const isError = <T, E>(result: Result<T, E>): result is { ok: false; error: E } => {
    return !result.ok
}

// ─── Test Execution ────────────────────────────────────────────────────────

/**
 * Execute a single golden test
 */
const executeTest = (test: GoldenTest): boolean => {
    console.log(`\n📝 Generating: ${test.name}`)
    if (test.description) {
        console.log(`   ${test.description}`)
    }

    const clusterName = test.clusterName || test.seed

    // 1. Ensure cluster exists
    const ensureResult = ensureCluster(clusterName)
    if (isError(ensureResult)) {
        console.error(`   ❌ Failed to ensure cluster: ${ensureResult.error}`)
        return false
    }

    // 2. Switch context
    const switchResult = switchContext(clusterName)
    if (isError(switchResult)) {
        console.error(`   ❌ Failed to switch context: ${switchResult.error}`)
        return false
    }

    // 3. Apply YAML files from seed
    const seedPath = getSeedPath(test.seed)
    const applyResult = applyYamlFiles(seedPath)
    if (isError(applyResult)) {
        console.error(`   ❌ Failed to apply YAML files: ${applyResult.error}`)
        return false
    }

    // 4. Wait for pods to be ready (if needed)
    if (test.waitForReady) {
        console.log(`   Waiting for pods to be ready...`)
        const waitResult = waitForPodsReady()
        if (isError(waitResult)) {
            console.warn(`   ⚠ Warning: ${waitResult.error}`)
            // Continue anyway (some pods might be in error state intentionally)
        }
    }

    // 5. Execute kubectl command
    console.log(`   Executing: ${test.command}`)
    const commandResult = runKubectlCommand(test.command)

    if (isError(commandResult)) {
        if (test.expectedError) {
            // Error is expected, use it as output
            const normalized = normalizeOutput(commandResult.error)
            const writeResult = writeGoldenFile(test.name, normalized, test.category)
            if (isError(writeResult)) {
                console.error(`   ❌ Failed to write golden file: ${writeResult.error}`)
                return false
            }
            console.log(`   ✓ Generated (error output): ${test.category}/${test.name}.txt`)
            return true
        } else {
            console.error(`   ❌ Command failed: ${commandResult.error}`)
            return false
        }
    }

    // 6. Normalize output
    const normalized = normalizeOutput(commandResult.value)

    // 7. Write golden file
    const writeResult = writeGoldenFile(test.name, normalized, test.category)
    if (isError(writeResult)) {
        console.error(`   ❌ Failed to write golden file: ${writeResult.error}`)
        return false
    }

    console.log(`   ✓ Generated: ${test.category}/${test.name}.txt`)
    return true
}

// ─── Helper Functions ──────────────────────────────────────────────────────

/**
 * List all available tests
 */
const listTests = () => {
    console.log('📋 Available Golden Tests\n')

    const byCategory = new Map<GoldenTestCategory, GoldenTest[]>()
    for (const test of GOLDEN_TESTS) {
        if (!byCategory.has(test.category)) {
            byCategory.set(test.category, [])
        }
        byCategory.get(test.category)!.push(test)
    }

    for (const [category, tests] of Array.from(byCategory.entries()).sort()) {
        console.log(`\n${category.toUpperCase()} (${tests.length} test(s)):`)
        for (const test of tests) {
            console.log(`  - ${test.name}`)
            if (test.description) {
                console.log(`    ${test.description}`)
            }
        }
    }

    console.log(`\nTotal: ${GOLDEN_TESTS.length} test(s)`)
}

/**
 * Validate category name
 */
const isValidCategory = (category: string): category is GoldenTestCategory => {
    return ['pods', 'events', 'version', 'cluster-info', 'api-resources', 'configmaps', 'secrets', 'describe', 'nodes'].includes(category)
}

// ─── Main ───────────────────────────────────────────────────────────────────

interface CliOptions {
    test?: string
    category?: string
    clean?: boolean
    list?: boolean
}

const main = async (options: CliOptions) => {
    console.log('🔧 Golden Files Generator')
    console.log('========================\n')

    // List tests if requested
    if (options.list) {
        listTests()
        process.exit(0)
    }

    // Clean all clusters if requested (and exit)
    if (options.clean) {
        console.log('🧹 Cleaning all existing clusters...')
        const cleanResult = deleteAllClusters()
        if (isError(cleanResult)) {
            console.error(`   ❌ Error: ${cleanResult.error}`)
            process.exit(1)
        }
        console.log('   ✓ All clusters deleted')
        process.exit(0)
    }

    // Filter tests based on CLI arguments
    let tests = GOLDEN_TESTS

    if (options.category) {
        if (!isValidCategory(options.category)) {
            console.error(`❌ Invalid category: ${options.category}`)
            console.error(`Valid categories: pods, events, version, cluster-info, api-resources, configmaps, secrets, describe, nodes`)
            process.exit(1)
        }
        tests = tests.filter(t => t.category === options.category)
        console.log(`Filtering by category: ${options.category} (${tests.length} test(s))`)
    }

    if (options.test) {
        tests = tests.filter(t => t.name === options.test)
        console.log(`Filtering by test: ${options.test} (${tests.length} test(s))`)
    }

    if (tests.length === 0) {
        console.error('❌ No tests to generate')
        process.exit(1)
    }

    console.log(`\nGenerating ${tests.length} golden file(s)...\n`)

    // Grouper les tests par cluster
    const testsByCluster = new Map<string, GoldenTest[]>()
    for (const test of tests) {
        const clusterName = test.clusterName || test.seed
        if (!testsByCluster.has(clusterName)) {
            testsByCluster.set(clusterName, [])
        }
        testsByCluster.get(clusterName)!.push(test)
    }

    // Track clusters to cleanup
    const clustersToCleanup = new Set<string>()

    // Execute all tests grouped by cluster
    let successCount = 0
    let failureCount = 0
    let currentCluster: string | null = null

    for (const [clusterName, clusterTests] of Array.from(testsByCluster.entries())) {
        // Supprimer le cluster précédent si on change de cluster
        if (currentCluster && currentCluster !== clusterName) {
            console.log(`\n🔄 Switching from cluster ${currentCluster} to ${clusterName}`)
            deleteCluster(currentCluster)
        }

        currentCluster = clusterName
        clustersToCleanup.add(clusterName)

        // Exécuter tous les tests de ce cluster
        for (const test of clusterTests) {
            const success = executeTest(test)
            if (success) {
                successCount++
            } else {
                failureCount++
            }
        }
    }

    // Cleanup clusters
    console.log('\n🗑️  Cleaning up clusters...')
    for (const clusterName of Array.from(clustersToCleanup)) {
        deleteCluster(clusterName)
    }

    // Summary
    console.log('\n' + '='.repeat(50))
    console.log(`✅ Success: ${successCount}`)
    if (failureCount > 0) {
        console.log(`❌ Failed: ${failureCount}`)
        process.exit(1)
    } else {
        console.log('🎉 All golden files generated successfully!')
    }
}

// Parse command line arguments and run
program.parse()
