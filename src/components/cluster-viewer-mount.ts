// ═══════════════════════════════════════════════════════════════════════════
// CLUSTER VIEWER MOUNT
// ═══════════════════════════════════════════════════════════════════════════
// Renders cluster state (nodes > pods > containers) and subscribes to eventBus.

import type { EmulatedEnvironment } from '../core/emulatedEnvironment/EmulatedEnvironment'
import type { Node } from '../core/cluster/ressources/Node'
import type { Pod } from '../core/cluster/ressources/Pod'
import { getNodeStatus } from '../core/cluster/ressources/Node'

const POD_PHASE_CLASS: Record<Pod['status']['phase'], string> = {
  Pending: 'cluster-viz__pod--pending',
  Running: 'cluster-viz__pod--running',
  Succeeded: 'cluster-viz__pod--succeeded',
  Failed: 'cluster-viz__pod--failed',
  Unknown: 'cluster-viz__pod--unknown'
}

const TOOLTIP_SELECTOR =
  '.cluster-viz__node, .cluster-viz__pod, .cluster-viz__container'
const NAMESPACE_FILTER_INPUT_SELECTOR = 'input[data-cluster-viz-namespace-toggle]'
const HIDDEN_NAMESPACES_BY_DEFAULT = new Set<string>([
  'kube-system',
  'local-path-storage'
])

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

function formatPodTooltip(pod: Pod): string {
  const name = `${pod.metadata.namespace}/${pod.metadata.name}`
  const phase = pod.status.phase
  const containers = (pod.spec.containers ?? []).map((c) => c.name).join(', ')
  const workloadType =
    pod.metadata.annotations?.['sim.kubernetes.io/workload-type'] ?? 'Pod'
  return `Pod\n${name}\nPhase: ${phase}\nWorkload: ${workloadType}\nContainers: ${containers || '(none)'}`
}

function formatContainerTooltip(container: {
  name: string
  image: string
}): string {
  return `Container\n${container.name}\nImage: ${container.image}`
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

function getSortedUniqueNamespaces(pods: Pod[]): string[] {
  const namespaces = new Set<string>()
  for (const pod of pods) {
    namespaces.add(pod.metadata.namespace)
  }
  return [...namespaces].sort((a, b) => {
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

function renderCluster(
  overlayContent: HTMLElement,
  env: EmulatedEnvironment,
  selectedNamespaces: Set<string>,
  knownNamespaces: Set<string>
): void {
  const nodes = env.clusterState.getNodes()
  const allPods = [...env.clusterState.getPods()].sort((a, b) => {
    const namespaceDiff = a.metadata.namespace.localeCompare(b.metadata.namespace)
    if (namespaceDiff !== 0) {
      return namespaceDiff
    }
    return a.metadata.name.localeCompare(b.metadata.name)
  })
  const namespaces = getSortedUniqueNamespaces(allPods)
  syncNamespaceSelection(namespaces, selectedNamespaces, knownNamespaces)
  const pods = allPods.filter((pod) => {
    return selectedNamespaces.has(pod.metadata.namespace)
  })

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
    nodeEl.dataset.tooltip = formatNodeTooltip(node)
    nodeEl.innerHTML = `
			<div class="cluster-viz__node-header">
				<span class="cluster-viz__node-name" title="${escapeAttr(name)}">${escapeHtml(name)}</span>
			</div>
			<div class="cluster-viz__pods"></div>
		`
    const podsContainer = nodeEl.querySelector('.cluster-viz__pods')!
    const sortedNodePods = [...nodePods].sort((a, b) => {
      const namespaceDiff = a.metadata.namespace.localeCompare(b.metadata.namespace)
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
        podsContainer.appendChild(createPodEl(pod))
      }
    }
    fragment.appendChild(nodeEl)
  }

  // Unscheduled pods (no node) - rendered last to keep it at the bottom.
  if (unscheduledPods.length > 0) {
    const nodeEl = document.createElement('div')
    nodeEl.className =
      'cluster-viz__node cluster-viz__node--unscheduled cluster-viz__node--unscheduled-row'
    nodeEl.dataset.tooltip = 'Node (unscheduled)\nPods not assigned to any node'
    nodeEl.innerHTML = `
			<div class="cluster-viz__node-header">
				<span class="cluster-viz__node-name">(unscheduled)</span>
			</div>
			<div class="cluster-viz__pods"></div>
		`
    const podsContainer = nodeEl.querySelector('.cluster-viz__pods')!
    for (const pod of unscheduledPods) {
      podsContainer.appendChild(createPodEl(pod))
    }
    fragment.appendChild(nodeEl)
  }

  const nodesWrap = document.createElement('div')
  nodesWrap.className = 'cluster-viz__nodes'
  nodesWrap.appendChild(fragment)

  overlayContent.innerHTML = ''
  if (namespaces.length > 0) {
    overlayContent.appendChild(createNamespaceFilterEl(namespaces, selectedNamespaces))
  }

  if (nodes.length === 0 && allPods.length === 0) {
    const empty = document.createElement('p')
    empty.className = 'cluster-viz__empty'
    empty.textContent = 'No nodes or pods yet.'
    overlayContent.appendChild(empty)
  } else {
    if (pods.length === 0) {
      const emptyFiltered = document.createElement('p')
      emptyFiltered.className = 'cluster-viz__empty'
      emptyFiltered.textContent = 'No pods for selected namespaces.'
      overlayContent.appendChild(emptyFiltered)
    }
    overlayContent.appendChild(nodesWrap)
  }
}

function createPodEl(pod: Pod): HTMLElement {
  const phase = pod.status.phase
  const phaseClass = POD_PHASE_CLASS[phase]
  const name = `${pod.metadata.namespace}/${pod.metadata.name}`
  const containers = pod.spec.containers ?? []
  const div = document.createElement('div')
  div.className = `cluster-viz__pod ${phaseClass}`
  div.dataset.tooltip = formatPodTooltip(pod)
  div.innerHTML = `
		<div class="cluster-viz__pod-header">
			<span class="cluster-viz__pod-name" title="${escapeAttr(name)}">${escapeHtml(pod.metadata.name)}</span>
			<span class="cluster-viz__pod-phase">${escapeHtml(phase)}</span>
		</div>
		<div class="cluster-viz__containers"></div>
	`
  const containersEl = div.querySelector('.cluster-viz__containers')!
  for (const c of containers) {
    const cEl = document.createElement('span')
    cEl.className = 'cluster-viz__container'
    cEl.textContent = c.name
    cEl.dataset.tooltip = formatContainerTooltip(c)
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
  const render = () =>
    renderCluster(contentElement, env, selectedNamespaces, knownNamespaces)
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

  contentElement.addEventListener('mouseover', onOver)
  contentElement.addEventListener('mouseout', onOut)
  contentElement.addEventListener('change', onNamespaceFilterChange)

  const unsub = env.eventBus.subscribeFiltered(
    (e) =>
      e.type.startsWith('Pod') ||
      e.type.startsWith('Node') ||
      e.type.startsWith('Deployment') ||
      e.type.startsWith('ReplicaSet'),
    () => {
      render()
    }
  )

  return () => {
    unsub()
    contentElement.removeEventListener('mouseover', onOver)
    contentElement.removeEventListener('mouseout', onOut)
    contentElement.removeEventListener('change', onNamespaceFilterChange)
    if (hideTimeout !== null) clearTimeout(hideTimeout)
    tooltipEl.remove()
  }
}
