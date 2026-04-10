set dotenv-load := true

# Local kind cluster (conformance / parity with clean)
kind-cluster := "conformance"
kind-config := "src/courses/seeds/clusterConfig/multi-node.yaml"

# Conformance (real vs simulator)
conformance:
    npx tsx conformance/run.ts

# Démarrer un seed (ex: minimal, deployment-with-configmap, multi-namespace, pods-errors)
cluster-start NAME:
    npx tsx bin/start-cluster.ts {{NAME}}

# Lister les clusters kind
cluster-list:
    kind get clusters

# Arrêter le cluster
cluster-down NAME:
    kind delete cluster --name {{NAME}}

# Delete local kind cluster (same as clean teardown)
stop:
    kind delete cluster --name {{kind-cluster}} || true

# Create local kind cluster (same topology as clean)
start:
    kind create cluster --name {{kind-cluster}} --config {{kind-config}}
    kubectl config set-context --current --namespace=default

# Reset local kind cluster for conformance tests
clean:
    kind delete cluster --name {{kind-cluster}} || true
    kind create cluster --name {{kind-cluster}} --config {{kind-config}}
    kubectl config set-context --current --namespace=default

compare:
    delta conformance/results/kind.log conformance/results/runner.log --side-by-side

# Build and quality gates
build:
    npm run build

check:
    npm run check

test:
    npm run test

# Local deploys via Dagger
dagger-install:
    npm run dagger:install

deploy-staging:
    npm run deploy:staging

deploy-production:
    npm run deploy:production

# Cloudflare Worker logs (live tail)
logs-tail:
    npx wrangler tail kubemastery --format pretty

# Focused webhook logs
logs-tail-webhook:
    npx wrangler tail kubemastery --format pretty | rg "paddle-webhook|/api/paddle/webhook|billing/webhook-processing|Invalid API key"

# Webhook logs with explicit HTTP status
logs-tail-webhook-json:
    npx wrangler tail kubemastery --format json | rg "/api/paddle/webhook|\"status\"|\"message\"|\"exceptions\"|\"logs\"|billing/webhook-processing|Invalid API key|paddle-webhook"
