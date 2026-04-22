set dotenv-load := true

kind-cluster := "conformance"
kind-config := "src/courses/seeds/clusterConfig/multi-node.yaml"

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

set drill_id:
    @if [ ! -f "src/courses/drills/{{drill_id}}/cluster.yaml" ]; then \
      echo "Missing file: src/courses/drills/{{drill_id}}/cluster.yaml"; \
      echo "This drill has no preloaded cluster environment."; \
      exit 1; \
    fi
    kubectl config use-context kind-{{kind-cluster}}
    kubectl apply -f "src/courses/drills/{{drill_id}}/cluster.yaml"
