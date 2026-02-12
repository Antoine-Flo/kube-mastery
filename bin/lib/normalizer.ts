/**
 * Normalise la sortie kubectl (réel ou sim) pour la comparaison conformance.
 * Remplace les valeurs variables (timestamps, UIDs, noms de pods, etc.) par des
 * placeholders afin que real et sim puissent matcher malgré les différences
 * d’environnement (cluster Kind vs simulateur).
 */
export const normalizeOutput = (output: string): string => {
  let normalized = output

  // ─── Timestamps (ISO et dates lisibles) ───────────────────────────────────
  // Les dates varient à chaque run ; on les ramène à un token unique pour comparer.
  normalized = normalized.replace(
    /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z/g,
    '<timestamp>'
  )
  normalized = normalized.replace(
    /\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/g,
    '<timestamp>'
  )
  normalized = normalized.replace(
    /creationTimestamp:\s*[^\n]+/g,
    'creationTimestamp: <timestamp>'
  )
  normalized = normalized.replace(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/gm,
    '<timestamp>'
  )

  // ─── UIDs et resourceVersion (métadonnées K8s) ──────────────────────────────
  // Générés par le serveur, différents entre cluster réel et sim.
  normalized = normalized.replace(/uid:\s*[a-f0-9-]{36}/gi, 'uid: <uid>')
  normalized = normalized.replace(
    /"uid"\s*:\s*"[a-f0-9-]{36}"/gi,
    '"uid": "<uid>"'
  )
  normalized = normalized.replace(
    /resourceVersion:\s*"\d+"/g,
    'resourceVersion: "<version>"'
  )
  normalized = normalized.replace(
    /"resourceVersion"\s*:\s*"\d+"/g,
    '"resourceVersion": "<version>"'
  )

  // ─── Âge relatif (describe / events) ─────────────────────────────────────
  // "5s ago", "2m ago", etc. → "Xs ago", "Xm ago" pour ignorer la valeur exacte.
  normalized = normalized.replace(/\d+s ago/g, 'Xs ago')
  normalized = normalized.replace(/\d+m ago/g, 'Xm ago')
  normalized = normalized.replace(/\d+h ago/g, 'Xh ago')
  normalized = normalized.replace(/\d+d ago/g, 'Xd ago')

  // ─── Adresses IP ─────────────────────────────────────────────────────────
  // IPs des pods/nodes différentes entre Kind et sim.
  normalized = normalized.replace(
    /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g,
    '<ip>'
  )

  // ─── Ports NodePort (30000–32767) ────────────────────────────────────────
  // Les ports alloués par le cluster ne sont pas déterministes.
  normalized = normalized.replace(/\b[3-9]\d{4}\b/g, (match: string) => {
    const port = parseInt(match, 10)
    return port > 30000 ? '<port>' : match
  })

  // ─── IDs de conteneurs (runtime) ──────────────────────────────────────────
  // docker://abc… ou containerd://abc… (64 caractères hex) ; spécifiques au node réel.
  normalized = normalized.replace(
    /docker:\/\/[a-f0-9]{64}/g,
    'docker://<container-id>'
  )
  normalized = normalized.replace(
    /containerd:\/\/[a-f0-9]{64}/g,
    'containerd://<container-id>'
  )

  // ─── Noms de nœuds Kind ──────────────────────────────────────────────────
  // kind-worker1, kind-control-plane, etc. → même placeholder pour tous les clusters.
  normalized = normalized.replace(/kind-worker\d+/g, '<node-name>')
  normalized = normalized.replace(/kind-control-plane/g, '<node-name>')

  // ─── Noms de pods système (style Kind / ReplicaSet) ───────────────────────
  // Réel : coredns-7d764666f9-59cxc ; sim : coredns-b9mlw7r7ai-mvf9n.
  // On normalise en coredns-<id> pour que la comparaison ne dépende pas du hash/suffix.
  normalized = normalized.replace(/coredns-[a-z0-9]+-[a-z0-9]+/g, 'coredns-<id>')
  normalized = normalized.replace(
    /kindnet-[a-z0-9]+(?:-[a-z0-9]+)?/g,
    'kindnet-<id>'
  )
  normalized = normalized.replace(
    /kube-proxy-[a-z0-9]+(?:-[a-z0-9]+)?/g,
    'kube-proxy-<id>'
  )
  normalized = normalized.replace(
    /local-path-provisioner-[a-z0-9]+(?:-[a-z0-9]+)?/g,
    'local-path-provisioner-<id>'
  )

  // ─── Noms des pods control-plane ─────────────────────────────────────────
  // Réel : etcd-minimal-control-plane (nom du cluster au milieu) ; sim : etcd-control-plane.
  // On unifie en etcd-<node>-control-plane pour matcher les deux.
  normalized = normalized.replace(
    /etcd-[a-z0-9]*-control-plane/g,
    'etcd-<node>-control-plane'
  )
  normalized = normalized.replace(
    /kube-apiserver-[a-z0-9]*-control-plane/g,
    'kube-apiserver-<node>-control-plane'
  )
  normalized = normalized.replace(
    /kube-controller-manager-[a-z0-9]*-control-plane/g,
    'kube-controller-manager-<node>-control-plane'
  )
  normalized = normalized.replace(
    /kube-scheduler-[a-z0-9]*-control-plane/g,
    'kube-scheduler-<node>-control-plane'
  )

  return normalized
}
