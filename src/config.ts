export const CONFIG = {
  i18n: {
    defaultLang: 'en',
    enableFrenchUi: false,
    enabledLanguages: ['en'],
    languageLabels: {
      en: 'English',
      fr: 'Français'
    }
  },
  cluster: {
    defaultConfigPath: 'src/courses/seeds/clusterConfig/multi-node.yaml',
    defaultNodeRoles: ['control-plane', 'worker', 'worker'],
    simulatorClusterName: 'sim',
    conformanceClusterName: 'conformance'
  },
  runtime: {
    simPodPendingDelayRangeMs: {
      minMs: 3000,
      maxMs: 4000
    },
    simPodSchedulingDelayRangeMs: {
      minMs: 900,
      maxMs: 2200
    },
    simRuntimeResyncIntervalMs: {
      deployment: 12000,
      replicaSet: 10000,
      daemonSet: 10000,
      podLifecycle: 4000,
      scheduler: 5000
    }
  },
  storage: {
    indexedDb: {
      name: 'kube-simulator',
      version: 1,
      storeName: 'sandbox-environments'
    }
  },
  billing: {
    paddlePriceIds: {
      production: {
        PRO_ONETIME: 'pri_01kk8zz1wknzpxrbg811wcxmxs',
        DISCOUNT_ONETIME: 'pri_01kk8zzkxbjemkbhvtkcbz0cg2'
      },
      staging: {
        PRO_ONETIME: 'pri_01kk8zz1wknzpxrbg811wcxmxs',
        DISCOUNT_ONETIME: 'pri_01kk8zzkxbjemkbhvtkcbz0cg2'
      }
    }
  }
} as const
