set dotenv-load := true

kind-cluster := "conformance"
kind-config := "src/courses/seeds/clusterConfig/multi-node.yaml"

conformance:
    npx tsx conformance/run.ts

stop:
    kind delete cluster --name {{kind-cluster}} || true

start:
    kind create cluster --name {{kind-cluster}} --config {{kind-config}}
    kubectl config set-context --current --namespace=default

clean:
    kind delete cluster --name {{kind-cluster}} || true
    kind create cluster --name {{kind-cluster}} --config {{kind-config}}
    kubectl config set-context --current --namespace=default

deploy-staging:
    npm run deploy:staging

deploy-production:
    npm run deploy:production
