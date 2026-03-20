export interface APIResourceDiscovery {
  name: string
  singularName: string
  shortNames?: string[]
  namespaced: boolean
  kind: string
  groupVersion: string
  verbs: string[]
  categories?: string[]
}

const DEFAULT_RESOURCE_VERBS = [
  'create',
  'delete',
  'deletecollection',
  'get',
  'list',
  'patch',
  'update',
  'watch'
]

const READ_ONLY_VERBS = ['get', 'list']
const CREATE_ONLY_VERBS = ['create']

export const API_DISCOVERY_CATALOG: APIResourceDiscovery[] = [
  {
    name: 'bindings',
    singularName: 'binding',
    namespaced: true,
    kind: 'Binding',
    groupVersion: 'v1',
    verbs: CREATE_ONLY_VERBS
  },
  {
    name: 'componentstatuses',
    singularName: 'componentstatus',
    shortNames: ['cs'],
    namespaced: false,
    kind: 'ComponentStatus',
    groupVersion: 'v1',
    verbs: READ_ONLY_VERBS
  },
  {
    name: 'configmaps',
    singularName: 'configmap',
    shortNames: ['cm'],
    namespaced: true,
    kind: 'ConfigMap',
    groupVersion: 'v1',
    verbs: DEFAULT_RESOURCE_VERBS
  },
  {
    name: 'endpoints',
    singularName: 'endpoints',
    shortNames: ['ep'],
    namespaced: true,
    kind: 'Endpoints',
    groupVersion: 'v1',
    verbs: DEFAULT_RESOURCE_VERBS
  },
  {
    name: 'events',
    singularName: 'event',
    shortNames: ['ev'],
    namespaced: true,
    kind: 'Event',
    groupVersion: 'v1',
    verbs: DEFAULT_RESOURCE_VERBS
  },
  {
    name: 'limitranges',
    singularName: 'limitrange',
    shortNames: ['limits'],
    namespaced: true,
    kind: 'LimitRange',
    groupVersion: 'v1',
    verbs: DEFAULT_RESOURCE_VERBS
  },
  {
    name: 'namespaces',
    singularName: 'namespace',
    shortNames: ['ns'],
    namespaced: false,
    kind: 'Namespace',
    groupVersion: 'v1',
    verbs: ['create', 'delete', 'get', 'list', 'patch', 'update', 'watch']
  },
  {
    name: 'nodes',
    singularName: 'node',
    shortNames: ['no'],
    namespaced: false,
    kind: 'Node',
    groupVersion: 'v1',
    verbs: DEFAULT_RESOURCE_VERBS
  },
  {
    name: 'persistentvolumeclaims',
    singularName: 'persistentvolumeclaim',
    shortNames: ['pvc'],
    namespaced: true,
    kind: 'PersistentVolumeClaim',
    groupVersion: 'v1',
    verbs: DEFAULT_RESOURCE_VERBS
  },
  {
    name: 'persistentvolumes',
    singularName: 'persistentvolume',
    shortNames: ['pv'],
    namespaced: false,
    kind: 'PersistentVolume',
    groupVersion: 'v1',
    verbs: DEFAULT_RESOURCE_VERBS
  },
  {
    name: 'pods',
    singularName: 'pod',
    shortNames: ['po'],
    namespaced: true,
    kind: 'Pod',
    groupVersion: 'v1',
    verbs: DEFAULT_RESOURCE_VERBS,
    categories: ['all']
  },
  {
    name: 'podtemplates',
    singularName: 'podtemplate',
    namespaced: true,
    kind: 'PodTemplate',
    groupVersion: 'v1',
    verbs: DEFAULT_RESOURCE_VERBS
  },
  {
    name: 'replicationcontrollers',
    singularName: 'replicationcontroller',
    shortNames: ['rc'],
    namespaced: true,
    kind: 'ReplicationController',
    groupVersion: 'v1',
    verbs: DEFAULT_RESOURCE_VERBS,
    categories: ['all']
  },
  {
    name: 'resourcequotas',
    singularName: 'resourcequota',
    shortNames: ['quota'],
    namespaced: true,
    kind: 'ResourceQuota',
    groupVersion: 'v1',
    verbs: DEFAULT_RESOURCE_VERBS
  },
  {
    name: 'secrets',
    singularName: 'secret',
    namespaced: true,
    kind: 'Secret',
    groupVersion: 'v1',
    verbs: DEFAULT_RESOURCE_VERBS
  },
  {
    name: 'serviceaccounts',
    singularName: 'serviceaccount',
    shortNames: ['sa'],
    namespaced: true,
    kind: 'ServiceAccount',
    groupVersion: 'v1',
    verbs: DEFAULT_RESOURCE_VERBS
  },
  {
    name: 'services',
    singularName: 'service',
    shortNames: ['svc'],
    namespaced: true,
    kind: 'Service',
    groupVersion: 'v1',
    verbs: DEFAULT_RESOURCE_VERBS
  },

  {
    name: 'mutatingwebhookconfigurations',
    singularName: 'mutatingwebhookconfiguration',
    namespaced: false,
    kind: 'MutatingWebhookConfiguration',
    groupVersion: 'admissionregistration.k8s.io/v1',
    verbs: DEFAULT_RESOURCE_VERBS
  },
  {
    name: 'validatingadmissionpolicies',
    singularName: 'validatingadmissionpolicy',
    namespaced: false,
    kind: 'ValidatingAdmissionPolicy',
    groupVersion: 'admissionregistration.k8s.io/v1',
    verbs: DEFAULT_RESOURCE_VERBS
  },
  {
    name: 'validatingadmissionpolicybindings',
    singularName: 'validatingadmissionpolicybinding',
    namespaced: false,
    kind: 'ValidatingAdmissionPolicyBinding',
    groupVersion: 'admissionregistration.k8s.io/v1',
    verbs: DEFAULT_RESOURCE_VERBS
  },
  {
    name: 'validatingwebhookconfigurations',
    singularName: 'validatingwebhookconfiguration',
    namespaced: false,
    kind: 'ValidatingWebhookConfiguration',
    groupVersion: 'admissionregistration.k8s.io/v1',
    verbs: DEFAULT_RESOURCE_VERBS
  },

  {
    name: 'customresourcedefinitions',
    singularName: 'customresourcedefinition',
    shortNames: ['crd', 'crds'],
    namespaced: false,
    kind: 'CustomResourceDefinition',
    groupVersion: 'apiextensions.k8s.io/v1',
    verbs: DEFAULT_RESOURCE_VERBS
  },
  {
    name: 'apiservices',
    singularName: 'apiservice',
    namespaced: false,
    kind: 'APIService',
    groupVersion: 'apiregistration.k8s.io/v1',
    verbs: DEFAULT_RESOURCE_VERBS
  },

  {
    name: 'controllerrevisions',
    singularName: 'controllerrevision',
    namespaced: true,
    kind: 'ControllerRevision',
    groupVersion: 'apps/v1',
    verbs: DEFAULT_RESOURCE_VERBS
  },
  {
    name: 'daemonsets',
    singularName: 'daemonset',
    shortNames: ['ds'],
    namespaced: true,
    kind: 'DaemonSet',
    groupVersion: 'apps/v1',
    verbs: DEFAULT_RESOURCE_VERBS,
    categories: ['all']
  },
  {
    name: 'deployments',
    singularName: 'deployment',
    shortNames: ['deploy'],
    namespaced: true,
    kind: 'Deployment',
    groupVersion: 'apps/v1',
    verbs: DEFAULT_RESOURCE_VERBS,
    categories: ['all']
  },
  {
    name: 'replicasets',
    singularName: 'replicaset',
    shortNames: ['rs'],
    namespaced: true,
    kind: 'ReplicaSet',
    groupVersion: 'apps/v1',
    verbs: DEFAULT_RESOURCE_VERBS,
    categories: ['all']
  },
  {
    name: 'statefulsets',
    singularName: 'statefulset',
    shortNames: ['sts'],
    namespaced: true,
    kind: 'StatefulSet',
    groupVersion: 'apps/v1',
    verbs: DEFAULT_RESOURCE_VERBS,
    categories: ['all']
  },

  {
    name: 'selfsubjectreviews',
    singularName: 'selfsubjectreview',
    namespaced: false,
    kind: 'SelfSubjectReview',
    groupVersion: 'authentication.k8s.io/v1',
    verbs: CREATE_ONLY_VERBS
  },
  {
    name: 'tokenreviews',
    singularName: 'tokenreview',
    namespaced: false,
    kind: 'TokenReview',
    groupVersion: 'authentication.k8s.io/v1',
    verbs: CREATE_ONLY_VERBS
  },

  {
    name: 'localsubjectaccessreviews',
    singularName: 'localsubjectaccessreview',
    namespaced: true,
    kind: 'LocalSubjectAccessReview',
    groupVersion: 'authorization.k8s.io/v1',
    verbs: CREATE_ONLY_VERBS
  },
  {
    name: 'selfsubjectaccessreviews',
    singularName: 'selfsubjectaccessreview',
    namespaced: false,
    kind: 'SelfSubjectAccessReview',
    groupVersion: 'authorization.k8s.io/v1',
    verbs: CREATE_ONLY_VERBS
  },
  {
    name: 'selfsubjectrulesreviews',
    singularName: 'selfsubjectrulesreview',
    namespaced: false,
    kind: 'SelfSubjectRulesReview',
    groupVersion: 'authorization.k8s.io/v1',
    verbs: CREATE_ONLY_VERBS
  },
  {
    name: 'subjectaccessreviews',
    singularName: 'subjectaccessreview',
    namespaced: false,
    kind: 'SubjectAccessReview',
    groupVersion: 'authorization.k8s.io/v1',
    verbs: CREATE_ONLY_VERBS
  },

  {
    name: 'horizontalpodautoscalers',
    singularName: 'horizontalpodautoscaler',
    shortNames: ['hpa'],
    namespaced: true,
    kind: 'HorizontalPodAutoscaler',
    groupVersion: 'autoscaling/v2',
    verbs: DEFAULT_RESOURCE_VERBS
  },

  {
    name: 'cronjobs',
    singularName: 'cronjob',
    shortNames: ['cj'],
    namespaced: true,
    kind: 'CronJob',
    groupVersion: 'batch/v1',
    verbs: DEFAULT_RESOURCE_VERBS,
    categories: ['all']
  },
  {
    name: 'jobs',
    singularName: 'job',
    namespaced: true,
    kind: 'Job',
    groupVersion: 'batch/v1',
    verbs: DEFAULT_RESOURCE_VERBS,
    categories: ['all']
  },

  {
    name: 'certificatesigningrequests',
    singularName: 'certificatesigningrequest',
    shortNames: ['csr'],
    namespaced: false,
    kind: 'CertificateSigningRequest',
    groupVersion: 'certificates.k8s.io/v1',
    verbs: DEFAULT_RESOURCE_VERBS
  },

  {
    name: 'leases',
    singularName: 'lease',
    shortNames: ['lease'],
    namespaced: true,
    kind: 'Lease',
    groupVersion: 'coordination.k8s.io/v1',
    verbs: DEFAULT_RESOURCE_VERBS
  },
  {
    name: 'endpointslices',
    singularName: 'endpointslice',
    namespaced: true,
    kind: 'EndpointSlice',
    groupVersion: 'discovery.k8s.io/v1',
    verbs: DEFAULT_RESOURCE_VERBS
  },
  {
    name: 'events',
    singularName: 'event',
    shortNames: ['ev'],
    namespaced: true,
    kind: 'Event',
    groupVersion: 'events.k8s.io/v1',
    verbs: DEFAULT_RESOURCE_VERBS
  },

  {
    name: 'flowschemas',
    singularName: 'flowschema',
    namespaced: false,
    kind: 'FlowSchema',
    groupVersion: 'flowcontrol.apiserver.k8s.io/v1',
    verbs: DEFAULT_RESOURCE_VERBS
  },
  {
    name: 'prioritylevelconfigurations',
    singularName: 'prioritylevelconfiguration',
    namespaced: false,
    kind: 'PriorityLevelConfiguration',
    groupVersion: 'flowcontrol.apiserver.k8s.io/v1',
    verbs: DEFAULT_RESOURCE_VERBS
  },

  {
    name: 'ingressclasses',
    singularName: 'ingressclass',
    namespaced: false,
    kind: 'IngressClass',
    groupVersion: 'networking.k8s.io/v1',
    verbs: DEFAULT_RESOURCE_VERBS
  },
  {
    name: 'ingresses',
    singularName: 'ingress',
    shortNames: ['ing'],
    namespaced: true,
    kind: 'Ingress',
    groupVersion: 'networking.k8s.io/v1',
    verbs: DEFAULT_RESOURCE_VERBS
  },
  {
    name: 'ipaddresses',
    singularName: 'ipaddress',
    shortNames: ['ip'],
    namespaced: false,
    kind: 'IPAddress',
    groupVersion: 'networking.k8s.io/v1',
    verbs: DEFAULT_RESOURCE_VERBS
  },
  {
    name: 'networkpolicies',
    singularName: 'networkpolicy',
    shortNames: ['netpol'],
    namespaced: true,
    kind: 'NetworkPolicy',
    groupVersion: 'networking.k8s.io/v1',
    verbs: DEFAULT_RESOURCE_VERBS
  },
  {
    name: 'servicecidrs',
    singularName: 'servicecidr',
    namespaced: false,
    kind: 'ServiceCIDR',
    groupVersion: 'networking.k8s.io/v1',
    verbs: DEFAULT_RESOURCE_VERBS
  },

  {
    name: 'runtimeclasses',
    singularName: 'runtimeclass',
    namespaced: false,
    kind: 'RuntimeClass',
    groupVersion: 'node.k8s.io/v1',
    verbs: DEFAULT_RESOURCE_VERBS
  },
  {
    name: 'poddisruptionbudgets',
    singularName: 'poddisruptionbudget',
    shortNames: ['pdb'],
    namespaced: true,
    kind: 'PodDisruptionBudget',
    groupVersion: 'policy/v1',
    verbs: DEFAULT_RESOURCE_VERBS
  },

  {
    name: 'clusterrolebindings',
    singularName: 'clusterrolebinding',
    namespaced: false,
    kind: 'ClusterRoleBinding',
    groupVersion: 'rbac.authorization.k8s.io/v1',
    verbs: DEFAULT_RESOURCE_VERBS
  },
  {
    name: 'clusterroles',
    singularName: 'clusterrole',
    namespaced: false,
    kind: 'ClusterRole',
    groupVersion: 'rbac.authorization.k8s.io/v1',
    verbs: DEFAULT_RESOURCE_VERBS
  },
  {
    name: 'rolebindings',
    singularName: 'rolebinding',
    namespaced: true,
    kind: 'RoleBinding',
    groupVersion: 'rbac.authorization.k8s.io/v1',
    verbs: DEFAULT_RESOURCE_VERBS
  },
  {
    name: 'roles',
    singularName: 'role',
    namespaced: true,
    kind: 'Role',
    groupVersion: 'rbac.authorization.k8s.io/v1',
    verbs: DEFAULT_RESOURCE_VERBS
  },

  {
    name: 'deviceclasses',
    singularName: 'deviceclass',
    namespaced: false,
    kind: 'DeviceClass',
    groupVersion: 'resource.k8s.io/v1',
    verbs: DEFAULT_RESOURCE_VERBS
  },
  {
    name: 'resourceclaims',
    singularName: 'resourceclaim',
    namespaced: true,
    kind: 'ResourceClaim',
    groupVersion: 'resource.k8s.io/v1',
    verbs: DEFAULT_RESOURCE_VERBS
  },
  {
    name: 'resourceclaimtemplates',
    singularName: 'resourceclaimtemplate',
    namespaced: true,
    kind: 'ResourceClaimTemplate',
    groupVersion: 'resource.k8s.io/v1',
    verbs: DEFAULT_RESOURCE_VERBS
  },
  {
    name: 'resourceslices',
    singularName: 'resourceslice',
    namespaced: false,
    kind: 'ResourceSlice',
    groupVersion: 'resource.k8s.io/v1',
    verbs: DEFAULT_RESOURCE_VERBS
  },

  {
    name: 'priorityclasses',
    singularName: 'priorityclass',
    shortNames: ['pc'],
    namespaced: false,
    kind: 'PriorityClass',
    groupVersion: 'scheduling.k8s.io/v1',
    verbs: DEFAULT_RESOURCE_VERBS
  },

  {
    name: 'csidrivers',
    singularName: 'csidriver',
    namespaced: false,
    kind: 'CSIDriver',
    groupVersion: 'storage.k8s.io/v1',
    verbs: DEFAULT_RESOURCE_VERBS
  },
  {
    name: 'csinodes',
    singularName: 'csinode',
    namespaced: false,
    kind: 'CSINode',
    groupVersion: 'storage.k8s.io/v1',
    verbs: DEFAULT_RESOURCE_VERBS
  },
  {
    name: 'csistoragecapacities',
    singularName: 'csistoragecapacity',
    namespaced: true,
    kind: 'CSIStorageCapacity',
    groupVersion: 'storage.k8s.io/v1',
    verbs: DEFAULT_RESOURCE_VERBS
  },
  {
    name: 'storageclasses',
    singularName: 'storageclass',
    shortNames: ['sc'],
    namespaced: false,
    kind: 'StorageClass',
    groupVersion: 'storage.k8s.io/v1',
    verbs: DEFAULT_RESOURCE_VERBS
  },
  {
    name: 'volumeattachments',
    singularName: 'volumeattachment',
    namespaced: false,
    kind: 'VolumeAttachment',
    groupVersion: 'storage.k8s.io/v1',
    verbs: DEFAULT_RESOURCE_VERBS
  },
  {
    name: 'volumeattributesclasses',
    singularName: 'volumeattributesclass',
    shortNames: ['vac'],
    namespaced: false,
    kind: 'VolumeAttributesClass',
    groupVersion: 'storage.k8s.io/v1',
    verbs: DEFAULT_RESOURCE_VERBS
  }
]
