// ═══════════════════════════════════════════════════════════════════════════
// CLUSTER VIEWER MOUNT
// ═══════════════════════════════════════════════════════════════════════════
// Renders cluster state (nodes > pods > containers) and subscribes to eventBus.

import type { EmulatedEnvironment } from '../core/emulatedEnvironment/EmulatedEnvironment'
import type { Node } from '../core/cluster/ressources/Node'
import type { Pod } from '../core/cluster/ressources/Pod'
import { getNodeStatus } from '../core/cluster/ressources/Node'
import type { SimServiceRuntime } from '../core/network/NetworkState'

const POD_PHASE_CLASS: Record<Pod['status']['phase'], string> = {
  Pending: 'cluster-viz__pod--pending',
  Running: 'cluster-viz__pod--running',
  Succeeded: 'cluster-viz__pod--succeeded',
  Failed: 'cluster-viz__pod--failed',
  Unknown: 'cluster-viz__pod--unknown'
}

const TOOLTIP_SELECTOR =
  '.cluster-viz__node, .cluster-viz__pod, .cluster-viz__container, .cluster-viz__service, .cluster-viz__service-endpoint'
const NAMESPACE_FILTER_INPUT_SELECTOR =
  'input[data-cluster-viz-namespace-toggle]'
const LAYER_TOGGLE_SELECTOR = 'button[data-cluster-viz-layer]'
const FOCUS_TARGET_SELECTOR = '[data-focus-kind][data-focus-id]'
const HIDDEN_NAMESPACES_BY_DEFAULT = new Set<string>([
  'kube-system',
  'local-path-storage'
])
type ClusterVizLayer = 'compute' | 'network'
type ClusterVizFocusKind = 'service' | 'pod' | 'node'

interface ClusterVizFocus {
  kind: ClusterVizFocusKind
  id: string
}

const isClusterVizLayer = (value: string): value is ClusterVizLayer => {
  if (value === 'compute' || value === 'network') {
    return true
  }
  return false
}

function formatNodeTooltip(node: Node): string {
  const status = getNodeStatus(node)
  const lines = ['Node', node.metadata.name, `Status: ${status}`]
  const conditions = node.status.conditions ?? []
  for (const c of conditions) {
    if (c.reason || c.message) {
      lines.push(
        `${c.type}: ${c.status}${c.reason ? ` (${c.reason})` : ''}${c.message ? `\n  ${c.message}` : ''}`
      )
    }
  }
  return lines.join('\n')
}

function getPodWorkloadType(pod: Pod, env: EmulatedEnvironment): string {
  const ownerRefs = pod.metadata.ownerReferences ?? []

  const daemonSetOwnerRef = ownerRefs.find((ref) => ref.kind === 'DaemonSet')
  if (daemonSetOwnerRef != null) {
    return 'DaemonSet'
  }

  const replicaSetOwnerRef = ownerRefs.find((ref) => ref.kind === 'ReplicaSet')
  if (replicaSetOwnerRef != null) {
    const replicaSet = env.apiServer
      .listResources('ReplicaSet', pod.metadata.namespace)
      .find((item) => item.metadata.name === replicaSetOwnerRef.name)
    if (replicaSet != null) {
      const replicaSetOwnerRefs = replicaSet.metadata.ownerReferences ?? []
      const deploymentOwnerRef = replicaSetOwnerRefs.find(
        (ref) => ref.kind === 'Deployment'
      )
      if (deploymentOwnerRef != null) {
        return 'Deployment'
      }
    }
    return 'ReplicaSet'
  }

  const fallbackWorkloadType =
    pod.metadata.annotations?.['sim.kubernetes.io/workload-type']
  if (fallbackWorkloadType != null && fallbackWorkloadType.length > 0) {
    return fallbackWorkloadType
  }

  return 'Pod'
}

function formatPodTooltip(pod: Pod, env: EmulatedEnvironment): string {
  const name = `${pod.metadata.namespace}/${pod.metadata.name}`
  const displayStatus = getPodDisplayStatus(pod)
  const containers = (pod.spec.containers ?? []).map((c) => c.name).join(', ')
  const workloadType = getPodWorkloadType(pod, env)
  return `Pod\n${name}\nStatus: ${displayStatus}\nWorkload: ${workloadType}\nContainers: ${containers || '(none)'}`
}

function formatContainerTooltip(
  container: {
    name: string
    image: string
  },
  status?: NonNullable<Pod['status']['containerStatuses']>[number]
): string {
  const state = status?.stateDetails?.state ?? 'Waiting'
  const reason =
    status?.stateDetails?.reason ??
    (state === 'Running' ? 'Started' : 'ContainerCreating')
  return `Container\n${container.name}\nImage: ${container.image}\nState: ${state}\nReason: ${reason}\nRestarts: ${status?.restartCount ?? 0}`
}

function getPodDisplayStatus(pod: Pod): string {
  if (pod.status.phase === 'Running') {
    return 'Running'
  }
  const statuses = pod.status.containerStatuses ?? []
  const statusWithReason = statuses.find((status) => {
    return status.stateDetails?.reason != null
  })
  if (statusWithReason?.stateDetails?.reason != null) {
    return statusWithReason.stateDetails.reason
  }
  return pod.status.phase
}

function setTooltipContent(tooltipEl: HTMLElement, raw: string): void {
  const lines = raw.split('\n')
  const kind = lines[0] ?? ''
  const name = lines[1] ?? ''
  const details = lines.slice(2).join('\n')
  tooltipEl.innerHTML = `
		<span class="cluster-viz__tooltip-kind">${escapeHtml(kind)}</span>
		<span class="cluster-viz__tooltip-name">${escapeHtml(name)}</span>
		<span class="cluster-viz__tooltip-details">${escapeHtml(details)}</span>
	`
}

export interface MountClusterViewerOptions {
  env: EmulatedEnvironment
}

function getSortedNamespaces(env: EmulatedEnvironment): string[] {
  const namespaces = env.apiServer.listResources('Namespace').map((namespace) => {
    return namespace.metadata.name
  })
  return namespaces.sort((a, b) => {
    return a.localeCompare(b)
  })
}

function syncNamespaceSelection(
  namespaces: string[],
  selectedNamespaces: Set<string>,
  knownNamespaces: Set<string>
): void {
  for (const knownNamespace of [...knownNamespaces]) {
    if (!namespaces.includes(knownNamespace)) {
      knownNamespaces.delete(knownNamespace)
      selectedNamespaces.delete(knownNamespace)
    }
  }

  for (const namespace of namespaces) {
    if (!knownNamespaces.has(namespace)) {
      knownNamespaces.add(namespace)
      if (!HIDDEN_NAMESPACES_BY_DEFAULT.has(namespace)) {
        selectedNamespaces.add(namespace)
      }
    }
  }
}

function createNamespaceFilterEl(
  namespaces: string[],
  selectedNamespaces: Set<string>
): HTMLElement {
  const filterEl = document.createElement('div')
  filterEl.className = 'cluster-viz__filter'

  const labelEl = document.createElement('span')
  labelEl.className = 'cluster-viz__filter-label'
  labelEl.textContent = 'Namespaces:'
  filterEl.appendChild(labelEl)

  const optionsEl = document.createElement('div')
  optionsEl.className = 'cluster-viz__filter-options'

  for (const namespace of namespaces) {
    const optionEl = document.createElement('label')
    optionEl.className = 'cluster-viz__filter-option'

    const inputEl = document.createElement('input')
    inputEl.type = 'checkbox'
    inputEl.checked = selectedNamespaces.has(namespace)
    inputEl.setAttribute('data-cluster-viz-namespace-toggle', 'true')
    inputEl.setAttribute('data-namespace', namespace)

    const nameEl = document.createElement('span')
    nameEl.textContent = namespace

    optionEl.appendChild(inputEl)
    optionEl.appendChild(nameEl)
    optionsEl.appendChild(optionEl)
  }

  filterEl.appendChild(optionsEl)
  return filterEl
}

function createLayerToggleEl(selectedLayer: ClusterVizLayer): HTMLElement {
  const wrapper = document.createElement('div')
  wrapper.className = 'cluster-viz__layer-toggle'

  const computeButton = document.createElement('button')
  computeButton.type = 'button'
  computeButton.className = 'cluster-viz__layer-button'
  computeButton.setAttribute('data-cluster-viz-layer', 'compute')
  computeButton.setAttribute(
    'aria-pressed',
    selectedLayer === 'compute' ? 'true' : 'false'
  )
  computeButton.textContent = 'Compute'
  if (selectedLayer === 'compute') {
    computeButton.classList.add('cluster-viz__layer-button--active')
  }

  const networkButton = document.createElement('button')
  networkButton.type = 'button'
  networkButton.className = 'cluster-viz__layer-button'
  networkButton.setAttribute('data-cluster-viz-layer', 'network')
  networkButton.setAttribute(
    'aria-pressed',
    selectedLayer === 'network' ? 'true' : 'false'
  )
  networkButton.textContent = 'Network'
  if (selectedLayer === 'network') {
    networkButton.classList.add('cluster-viz__layer-button--active')
  }

  wrapper.appendChild(computeButton)
  wrapper.appendChild(networkButton)

  return wrapper
}

function getPodFocusId(pod: Pod): string {
  return `${pod.metadata.namespace}/${pod.metadata.name}`
}

function getServiceFocusId(service: SimServiceRuntime): string {
  return `${service.namespace}/${service.serviceName}`
}

function getNodeFocusId(nodeName: string): string {
  return nodeName
}

function isFocused(
  focus: ClusterVizFocus | null,
  kind: ClusterVizFocusKind,
  id: string
): boolean {
  if (focus == null) {
    return false
  }
  if (focus.kind !== kind) {
    return false
  }
  return focus.id === id
}

function formatServiceTooltip(service: SimServiceRuntime): string {
  const serviceKey = `${service.namespace}/${service.serviceName}`
  const addresses =
    service.clusterIP != null && service.clusterIP !== 'None'
      ? service.clusterIP
      : service.serviceType === 'ExternalName'
        ? 'ExternalName'
        : 'Headless'
  const ports = service.ports
    .map((port) => {
      const nodePortSuffix =
        port.nodePort != null ? ` (nodePort: ${port.nodePort})` : ''
      return `${port.port} -> ${port.targetPort}/${port.protocol}${nodePortSuffix}`
    })
    .join(', ')
  return `Service\n${serviceKey}\nType: ${service.serviceType}\nAddress: ${addresses}\nPorts: ${ports || '(none)'}\nEndpoints: ${service.endpoints.length}`
}

function formatServiceEndpointTooltip(
  service: SimServiceRuntime,
  endpoint: SimServiceRuntime['endpoints'][number]
): string {
  const endpointName = `${endpoint.namespace}/${endpoint.podName}`
  return `Endpoint\n${service.namespace}/${service.serviceName}\nPod: ${endpointName}\nTarget: ${endpoint.podIP}:${endpoint.targetPort}${endpoint.nodeName != null ? `\nNode: ${endpoint.nodeName}` : ''}`
}

function createServiceEl(
  service: SimServiceRuntime,
  focus: ClusterVizFocus | null
): HTMLElement {
  const serviceEl = document.createElement('div')
  serviceEl.className = 'cluster-viz__service'
  serviceEl.dataset.tooltip = formatServiceTooltip(service)
  const serviceFocusId = getServiceFocusId(service)
  serviceEl.setAttribute('data-focus-kind', 'service')
  serviceEl.setAttribute('data-focus-id', serviceFocusId)
  if (isFocused(focus, 'service', serviceFocusId)) {
    serviceEl.classList.add('cluster-viz__service--focused')
  }

  const typeClass =
    service.serviceType === 'NodePort'
      ? 'cluster-viz__service-type--nodeport'
      : service.serviceType === 'LoadBalancer'
        ? 'cluster-viz__service-type--loadbalancer'
        : service.serviceType === 'ExternalName'
          ? 'cluster-viz__service-type--externalname'
          : 'cluster-viz__service-type--clusterip'

  const portsText = service.ports
    .map((port) => {
      const nodePortSuffix =
        port.nodePort != null ? ` / nodePort ${port.nodePort}` : ''
      return `${port.port} -> ${port.targetPort}${nodePortSuffix}`
    })
    .join(' • ')

  serviceEl.innerHTML = `
		<div class="cluster-viz__service-header">
			<span class="cluster-viz__service-name">${escapeHtml(service.serviceName)}</span>
			<span class="cluster-viz__service-type ${typeClass}">${escapeHtml(service.serviceType)}</span>
		</div>
		<div class="cluster-viz__service-meta">
			<span>${escapeHtml(service.namespace)}</span>
			<span>${escapeHtml(service.clusterIP ?? 'no ClusterIP')}</span>
		</div>
		<div class="cluster-viz__service-ports">${escapeHtml(portsText || 'No ports')}</div>
		<div class="cluster-viz__service-endpoints"></div>
	`

  const endpointsContainer = serviceEl.querySelector(
    '.cluster-viz__service-endpoints'
  )
  if (endpointsContainer != null) {
    if (service.endpoints.length === 0) {
      const empty = document.createElement('span')
      empty.className = 'cluster-viz__service-endpoints-empty'
      empty.textContent = 'No endpoints'
      endpointsContainer.appendChild(empty)
    } else {
      for (const endpoint of service.endpoints) {
        const endpointEl = document.createElement('span')
        endpointEl.className = 'cluster-viz__service-endpoint'
        endpointEl.textContent = `${endpoint.podName}:${endpoint.targetPort}`
        endpointEl.dataset.tooltip = formatServiceEndpointTooltip(
          service,
          endpoint
        )
        endpointsContainer.appendChild(endpointEl)
      }
    }
  }

  return serviceEl
}

function renderComputeLayer(
  overlayContent: HTMLElement,
  env: EmulatedEnvironment,
  pods: Pod[],
  allPods: Pod[],
  nodes: Node[],
  focus: ClusterVizFocus | null
): void {
  const podsByNode = new Map<string, Pod[]>()
  for (const pod of pods) {
    const nodeName = pod.spec.nodeName ?? ''
    if (!podsByNode.has(nodeName)) {
      podsByNode.set(nodeName, [])
    }
    podsByNode.get(nodeName)!.push(pod)
  }

  const sortedNodes = [...nodes].sort((a, b) => {
    return a.metadata.name.localeCompare(b.metadata.name)
  })
  const unscheduledPods = podsByNode.get('') ?? []
  if (unscheduledPods.length > 0) {
    podsByNode.set('', unscheduledPods)
  }

  const fragment = document.createDocumentFragment()

  // Nodes with pods
  for (const node of sortedNodes) {
    const name = node.metadata.name
    const nodePods = podsByNode.get(name) ?? []
    const nodeEl = document.createElement('div')
    const status = getNodeStatus(node)
    nodeEl.className =
      status === 'Ready'
        ? 'cluster-viz__node'
        : 'cluster-viz__node cluster-viz__node--unscheduled'
    const nodeFocusId = getNodeFocusId(node.metadata.name)
    nodeEl.setAttribute('data-focus-kind', 'node')
    nodeEl.setAttribute('data-focus-id', nodeFocusId)
    if (isFocused(focus, 'node', nodeFocusId)) {
      nodeEl.classList.add('cluster-viz__node--focused')
    }
    nodeEl.dataset.tooltip = formatNodeTooltip(node)
    nodeEl.innerHTML = `
			<div class="cluster-viz__node-header">
				<span class="cluster-viz__node-name" title="${escapeAttr(name)}">${escapeHtml(name)}</span>
			</div>
			<div class="cluster-viz__pods"></div>
		`
    const podsContainer = nodeEl.querySelector('.cluster-viz__pods')!
    const sortedNodePods = [...nodePods].sort((a, b) => {
      const namespaceDiff = a.metadata.namespace.localeCompare(
        b.metadata.namespace
      )
      if (namespaceDiff !== 0) {
        return namespaceDiff
      }
      return a.metadata.name.localeCompare(b.metadata.name)
    })
    if (sortedNodePods.length === 0) {
      const empty = document.createElement('span')
      empty.className = 'cluster-viz__no-pods'
      empty.textContent = 'No pods'
      podsContainer.appendChild(empty)
    } else {
      for (const pod of sortedNodePods) {
        podsContainer.appendChild(createPodEl(pod, env, focus))
      }
    }
    fragment.appendChild(nodeEl)
  }

  // Unscheduled pods (no node) - rendered last to keep it at the bottom.
  if (unscheduledPods.length > 0) {
    const nodeEl = document.createElement('div')
    nodeEl.className =
      'cluster-viz__node cluster-viz__node--unscheduled cluster-viz__node--unscheduled-row'
    nodeEl.setAttribute('data-focus-kind', 'node')
    nodeEl.setAttribute('data-focus-id', getNodeFocusId('(unscheduled)'))
    nodeEl.dataset.tooltip = 'Node (unscheduled)\nPods not assigned to any node'
    nodeEl.innerHTML = `
			<div class="cluster-viz__node-header">
				<span class="cluster-viz__node-name">(unscheduled)</span>
			</div>
			<div class="cluster-viz__pods"></div>
		`
    const podsContainer = nodeEl.querySelector('.cluster-viz__pods')!
    for (const pod of unscheduledPods) {
      podsContainer.appendChild(createPodEl(pod, env, focus))
    }
    fragment.appendChild(nodeEl)
  }

  const nodesWrap = document.createElement('div')
  nodesWrap.className = 'cluster-viz__nodes'
  nodesWrap.appendChild(fragment)

  if (nodes.length === 0 && allPods.length === 0) {
    const empty = document.createElement('p')
    empty.className = 'cluster-viz__empty'
    empty.textContent = 'No nodes or pods yet.'
    overlayContent.appendChild(empty)
    return
  }
  if (pods.length === 0) {
    const emptyFiltered = document.createElement('p')
    emptyFiltered.className = 'cluster-viz__empty'
    emptyFiltered.textContent = 'No pods for selected namespaces.'
    overlayContent.appendChild(emptyFiltered)
  }
  overlayContent.appendChild(nodesWrap)
}

function renderNetworkLayer(
  overlayContent: HTMLElement,
  env: EmulatedEnvironment,
  selectedNamespaces: Set<string>,
  focus: ClusterVizFocus | null
): void {
  if (env.networkRuntime == null) {
    const empty = document.createElement('p')
    empty.className = 'cluster-viz__empty'
    empty.textContent = 'Network runtime is not available.'
    overlayContent.appendChild(empty)
    return
  }

  const services = env.networkRuntime.state
    .listServiceRuntimes()
    .filter((service) => {
      return selectedNamespaces.has(service.namespace)
    })
    .sort((a, b) => {
      const namespaceDiff = a.namespace.localeCompare(b.namespace)
      if (namespaceDiff !== 0) {
        return namespaceDiff
      }
      return a.serviceName.localeCompare(b.serviceName)
    })

  if (services.length === 0) {
    const empty = document.createElement('p')
    empty.className = 'cluster-viz__empty'
    empty.textContent = 'No services for selected namespaces.'
    overlayContent.appendChild(empty)
    return
  }

  const servicesWrap = document.createElement('div')
  servicesWrap.className = 'cluster-viz__services'
  for (const service of services) {
    servicesWrap.appendChild(createServiceEl(service, focus))
  }
  overlayContent.appendChild(servicesWrap)
}

function renderCluster(
  overlayContent: HTMLElement,
  env: EmulatedEnvironment,
  selectedNamespaces: Set<string>,
  knownNamespaces: Set<string>,
  selectedLayer: ClusterVizLayer,
  focus: ClusterVizFocus | null
): void {
  const nodes = env.apiServer.listResources('Node')
  const allPods = [...env.apiServer.listResources('Pod')].sort((a, b) => {
    const namespaceDiff = a.metadata.namespace.localeCompare(
      b.metadata.namespace
    )
    if (namespaceDiff !== 0) {
      return namespaceDiff
    }
    return a.metadata.name.localeCompare(b.metadata.name)
  })
  const namespaces = getSortedNamespaces(env)
  syncNamespaceSelection(namespaces, selectedNamespaces, knownNamespaces)
  const pods = allPods.filter((pod) => {
    return selectedNamespaces.has(pod.metadata.namespace)
  })

  overlayContent.innerHTML = ''
  overlayContent.appendChild(createLayerToggleEl(selectedLayer))
  if (namespaces.length > 0) {
    overlayContent.appendChild(
      createNamespaceFilterEl(namespaces, selectedNamespaces)
    )
  }
  if (selectedLayer === 'network') {
    renderNetworkLayer(overlayContent, env, selectedNamespaces, focus)
    return
  }
  renderComputeLayer(overlayContent, env, pods, allPods, nodes, focus)
}

function createPodEl(
  pod: Pod,
  env: EmulatedEnvironment,
  focus: ClusterVizFocus | null
): HTMLElement {
  const phase = pod.status.phase
  const displayStatus = getPodDisplayStatus(pod)
  const phaseClass = POD_PHASE_CLASS[phase]
  const name = `${pod.metadata.namespace}/${pod.metadata.name}`
  const containers = pod.spec.containers ?? []
  const statusesByName = new Map(
    (pod.status.containerStatuses ?? []).map((status) => {
      return [status.name, status]
    })
  )
  const div = document.createElement('div')
  div.className = `cluster-viz__pod ${phaseClass}`
  div.setAttribute('data-focus-kind', 'pod')
  div.setAttribute('data-focus-id', name)
  if (isFocused(focus, 'pod', name)) {
    div.classList.add('cluster-viz__pod--focused')
  }
  div.dataset.tooltip = formatPodTooltip(pod, env)
  div.innerHTML = `
		<div class="cluster-viz__pod-header">
			<span class="cluster-viz__pod-name" title="${escapeAttr(name)}">${escapeHtml(pod.metadata.name)}</span>
			<span class="cluster-viz__pod-phase">${escapeHtml(displayStatus)}</span>
		</div>
		<div class="cluster-viz__containers"></div>
	`
  const containersEl = div.querySelector('.cluster-viz__containers')!
  for (const c of containers) {
    const containerStatus = statusesByName.get(c.name)
    const containerState = containerStatus?.stateDetails?.state
    const containerStateClass =
      containerState === 'Running'
        ? 'cluster-viz__container--running'
        : containerState === 'Terminated'
          ? 'cluster-viz__container--terminated'
          : 'cluster-viz__container--waiting'
    const cEl = document.createElement('span')
    cEl.className = `cluster-viz__container ${containerStateClass}`
    cEl.textContent = c.name
    cEl.dataset.tooltip = formatContainerTooltip(c, containerStatus)
    containersEl.appendChild(cEl)
  }
  return div
}

function escapeHtml(s: string): string {
  const div = document.createElement('div')
  div.textContent = s
  return div.innerHTML
}
function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/"/g, '&quot;')
}

/** Mounts cluster viz into a content container; returns cleanup. */
export function mountClusterViewer(
  contentElement: HTMLElement,
  options: MountClusterViewerOptions
): () => void {
  const { env } = options
  const selectedNamespaces = new Set<string>()
  const knownNamespaces = new Set<string>()
  let selectedLayer: ClusterVizLayer = 'compute'
  let focus: ClusterVizFocus | null = null
  const render = () =>
    renderCluster(
      contentElement,
      env,
      selectedNamespaces,
      knownNamespaces,
      selectedLayer,
      focus
    )
  render()

  const tooltipEl = document.createElement('div')
  tooltipEl.className = 'cluster-viz__tooltip'
  tooltipEl.style.cssText =
    'display:none;position:fixed;z-index:1000;pointer-events:none;'
  document.body.appendChild(tooltipEl)

  let hideTimeout: ReturnType<typeof setTimeout> | null = null

  function showTooltip(el: Element): void {
    const text = el.getAttribute('data-tooltip')
    if (!text) {
      return
    }
    if (hideTimeout !== null) {
      clearTimeout(hideTimeout)
      hideTimeout = null
    }
    setTooltipContent(tooltipEl, text)
    tooltipEl.style.display = 'block'
    const rect = el.getBoundingClientRect()
    const tw = tooltipEl.offsetWidth
    const th = tooltipEl.offsetHeight
    const margin = 8
    const aboveY = rect.top - 4 - th
    const belowY = rect.bottom + 4
    const topPreferred = aboveY >= margin ? aboveY : belowY
    const topClamped = Math.max(
      margin,
      Math.min(window.innerHeight - th - margin, topPreferred)
    )
    const left = Math.max(
      margin,
      Math.min(
        window.innerWidth - tw - margin,
        rect.left + rect.width / 2 - tw / 2
      )
    )
    tooltipEl.style.left = `${left}px`
    tooltipEl.style.top = `${topClamped}px`
  }

  function hideTooltip(): void {
    tooltipEl.style.display = 'none'
  }

  function onOver(e: MouseEvent): void {
    const target = (e.target as Element).closest(TOOLTIP_SELECTOR)
    if (target && target.getAttribute('data-tooltip')) {
      showTooltip(target)
    }
  }

  function onOut(e: MouseEvent): void {
    const relatedEl = e.relatedTarget as Element | null
    if (relatedEl && contentElement.contains(relatedEl)) {
      const next = relatedEl.closest(TOOLTIP_SELECTOR)
      if (next && next.getAttribute('data-tooltip')) {
        showTooltip(next)
        return
      }
    }
    hideTimeout = setTimeout(() => {
      hideTooltip()
      hideTimeout = null
    }, 50)
  }

  function onNamespaceFilterChange(e: Event): void {
    const target = e.target as HTMLInputElement | null
    if (!target || !target.matches(NAMESPACE_FILTER_INPUT_SELECTOR)) {
      return
    }

    const namespace = target.getAttribute('data-namespace')
    if (!namespace) {
      return
    }

    if (target.checked) {
      selectedNamespaces.add(namespace)
    } else {
      selectedNamespaces.delete(namespace)
    }
    render()
  }

  function onLayerChange(e: Event): void {
    const target = (e.target as Element | null)?.closest(LAYER_TOGGLE_SELECTOR)
    if (target == null) {
      return
    }
    const layerValue = target.getAttribute('data-cluster-viz-layer')
    if (layerValue == null || !isClusterVizLayer(layerValue)) {
      return
    }
    if (selectedLayer === layerValue) {
      return
    }
    selectedLayer = layerValue
    render()
  }

  function onFocusClick(e: Event): void {
    const focusTarget = (e.target as Element | null)?.closest(
      FOCUS_TARGET_SELECTOR
    )
    if (focusTarget == null) {
      return
    }
    const kind = focusTarget.getAttribute('data-focus-kind')
    const id = focusTarget.getAttribute('data-focus-id')
    if (kind == null || id == null) {
      return
    }
    if (kind !== 'service' && kind !== 'pod' && kind !== 'node') {
      return
    }
    if (focus != null && focus.kind === kind && focus.id === id) {
      focus = null
      render()
      return
    }
    focus = {
      kind,
      id
    }
    render()
  }

  contentElement.addEventListener('mouseover', onOver)
  contentElement.addEventListener('mouseout', onOut)
  contentElement.addEventListener('change', onNamespaceFilterChange)
  contentElement.addEventListener('click', onLayerChange)
  contentElement.addEventListener('click', onFocusClick)

  const unsub = env.apiServer.watchHub.watchAllClusterEvents((event) => {
    const shouldRender =
      event.type.startsWith('Pod') ||
      event.type.startsWith('Node') ||
      event.type.startsWith('Service') ||
      event.type.startsWith('Deployment') ||
      event.type.startsWith('ReplicaSet') ||
      event.type.startsWith('DaemonSet')
    if (!shouldRender) {
      return
    }
    render()
  })

  return () => {
    unsub()
    contentElement.removeEventListener('mouseover', onOver)
    contentElement.removeEventListener('mouseout', onOut)
    contentElement.removeEventListener('change', onNamespaceFilterChange)
    contentElement.removeEventListener('click', onLayerChange)
    contentElement.removeEventListener('click', onFocusClick)
    if (hideTimeout !== null) {
      clearTimeout(hideTimeout)
    }
    tooltipEl.remove()
  }
}
