# ═══════════════════════════════════════════════════════════════════════════
# GOLDEN FILES GENERATION
# ═══════════════════════════════════════════════════════════════════════════

# Générer tous les golden files
golden:
    npx tsx bin/generate-golden-files.ts

# Générer les golden files pour une catégorie spécifique
golden-category CATEGORY:
    npx tsx bin/generate-golden-files.ts --category {{CATEGORY}}

# Générer les golden files pour un test spécifique
golden-test TEST:
    npx tsx bin/generate-golden-files.ts --test {{TEST}}

# Lister tous les tests disponibles
golden-list:
    npx tsx bin/generate-golden-files.ts --list

# Nettoyer tous les clusters
golden-clean:
    npx tsx bin/generate-golden-files.ts --clean
