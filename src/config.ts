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
        BASIC_MONTHLY: 'pri_01kk19a0xpmxppknwqs4s6x92r',
        BASIC_YEARLY: 'pri_01kk1954dx0qy5bze4ndcy3r2z',
        PRO_MONTHLY: 'pri_01kk19hgyx476qxaewqx90zjex',
        PRO_YEARLY: 'pri_01kk19g1tkb4hjvyj9dpcrbrda'
      },
      staging: {
        BASIC_MONTHLY: 'pri_01kjfr83ph95rmgypgrdsc20bs',
        BASIC_YEARLY: 'pri_01kjfr962x53wh4wnkywjmc94s',
        PRO_MONTHLY: 'pri_01kjfgeb1amgf8ht2fxaqsshhg',
        PRO_YEARLY: 'pri_01kjfgg9mz5586yyaxkepp4aa3'
      }
    }
  }
} as const
