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
  auth: {
    magicLinkRateLimit: {
      windowMs: 5 * 60 * 1000,
      maxRequests: 5
    }
  },
  billing: {
    paddlePriceIds: {
      production: {
        PRO_ONETIME: 'pri_01kk946043kwcxptt6d7zq516s',
        DISCOUNT_ONETIME: 'pri_01kk946hggdk42gvv17frzbbpv'
      },
      staging: {
        PRO_ONETIME: 'pri_01kk8zz1wknzpxrbg811wcxmxs',
        DISCOUNT_ONETIME: 'pri_01kk8zzkxbjemkbhvtkcbz0cg2'
      }
    },
    refundRateLimit: {
      windowMs: 10 * 60 * 1000,
      maxRequests: 2
    }
  },
  contact: {
    email: {
      to: 'antoineflouzat@mailbox.org',
      from: {
        name: 'KubeMastery Support',
        email: 'no-reply@kubemastery.com'
      }
    },
    rateLimit: {
      windowMs: 5 * 60 * 1000,
      maxRequests: 3
    }
  },
  cluster: {
    defaultConfigPath: 'src/courses/seeds/clusterConfig/multi-node.yaml',
    defaultNodeRoles: ['control-plane', 'worker', 'worker'],
    simulatorClusterName: 'sim',
    conformanceClusterName: 'conformance',
    kubeconfigServerUrl: 'https://127.0.0.1:41666'
  },
  runtime: {
    simPodPendingDelayRangeMs: {
      minMs: 3000,
      maxMs: 4000
    },
    simPodCompletionDelayRangeMs: {
      minMs: 1800,
      maxMs: 2600
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
  }
} as const
