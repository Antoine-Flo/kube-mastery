set dotenv-load

app := "kube-simulator"

deploy:
    #!/usr/bin/env bash
    set -euxo pipefail
    git_tag="$(git rev-parse --short HEAD)"
    fly deploy \
        --app {{app}} \
        --image-label "$git_tag" \
        --build-secret VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
        --build-secret VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY=$VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY \
        --build-secret VITE_SENTRY_DSN=$VITE_SENTRY_DSN

releases:
    fly releases --app {{app}} --image

rollback:
    #!/usr/bin/env bash
    set -euxo pipefail
    # Récupère la deuxième release (version précédente, ligne 3: en-tête + v41 actuelle + v40 précédente)
    prev_image=$(fly releases --app {{app}} --image | sed -n '3p' | awk '{print $NF}')
    if [ -z "$prev_image" ]; then
        echo "❌ Aucune version précédente trouvée"
        exit 1
    fi
    echo "🔄 Rollback vers: $prev_image"
    fly deploy --app {{app}} --image "$prev_image"

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

# ═══════════════════════════════════════════════════════════════════════════
# COURSE INDEXES GENERATION
# ═══════════════════════════════════════════════════════════════════════════

# Synchroniser les index des cours et modules vers la base de données
sync-courses:
    npx tsx bin/sync-courses-db.ts

# Afficher le plan de synchronisation (dry-run)
sync-plan:
    npx tsx bin/sync-courses-db.ts --dry-run