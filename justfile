# Conformance (real vs simulator)
conformance:
    npx tsx bin/run-conformance.ts

# Démarrer un seed (ex: minimal, deployment-with-configmap, multi-namespace, pods-errors)
cluster-start NAME:
    npx tsx bin/start-cluster.ts {{NAME}}

# Lister les clusters kind
cluster-list:
    kind get clusters

# Arrêter le cluster
cluster-down NAME:
    kind delete cluster --name {{NAME}}

compare:
    delta artifacts/conformance/kind.log artifacts/conformance/runner.log --side-by-side
