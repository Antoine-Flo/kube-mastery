export type NewsLang = 'en' | 'fr'

export interface NewsItem {
  id: string
  publishedAt: string
  sourceName: string
  sourceUrl: string
  headline: string
  tldr: string
  whyItMatters: string
  tags: string[]
}

// Tone guide for tldr and whyItMatters:
// Write like you're explaining the news to a colleague over coffee.
// Be clear and direct, but not robotic. Avoid bullet-point-in-disguise phrasing, avoid "—"
// tldr: tell the story of what happened, in plain language. Keep the key facts (CVEs, tool names, versions)
//   but don't just concatenate them — make it readable in one go.
// whyItMatters: one or two sentences max. Lead with the real-world consequence, then the takeaway.
//   Prefer "you" and "your" over passive constructions.
const englishNews: NewsItem[] = [
  {
    id: 'broadcom-velero-cncf',
    publishedAt: '2026-03-24',
    sourceName: 'The New Stack',
    sourceUrl: 'https://thenewstack.io/broadcom-velero-cncf-kubernetes/',
    headline: 'Broadcom donates Velero to CNCF, reshaping Kubernetes backup and disaster recovery',
    tldr:
      'Broadcom is handing Velero over to the CNCF, which means the go-to Kubernetes backup tool is now community-owned. On top of that, VKS 3.6 lets you pick your own CNI at cluster creation and ships performance profiles for databases and AI workloads.',
    whyItMatters:
      'Kubernetes still has no built-in backup story, so Velero filling that gap under neutral governance is a real win. Less vendor lock-in, more confidence that the project sticks around.',
    tags: ['cncf', 'backup', 'open-source', 'velero']
  },
  {
    id: 'trivy-supply-chain-attack',
    publishedAt: '2026-03-23',
    sourceName: 'The Hacker News',
    sourceUrl: 'https://thehackernews.com/2026/03/trivy-hack-spreads-infostealer-via.html',
    headline: 'Trivy supply chain attack spreads infostealer via Docker and deploys Kubernetes wiper',
    tldr:
      'Someone stole Aqua Security credentials and slipped malware into Trivy versions 0.69.4 through 0.69.6 on Docker Hub. Those stolen credentials then kicked off a self-spreading worm across npm, and to top it off, a wiper started nuking Kubernetes clusters by deploying privileged DaemonSets on every node. CVE-2026-33634, CVSS 9.4.',
    whyItMatters:
      'One compromised bot account bridging two GitHub orgs was all it took to cascade from a scanner to live cluster destruction. If you have Trivy in your pipeline, treat any recent run as suspect and start pinning your Actions by commit SHA.',
    tags: ['security', 'supply-chain', 'docker', 'cve']
  }
]

// Guide de ton pour tldr et whyItMatters :
// Ecrire comme si on expliquait l'actu a un collegue autour d'un cafe.
// Clair et direct, mais pas robotique. Eviter les phrases qui ressemblent a des listes degui sees.
// tldr : raconter ce qui s'est passe en langage naturel. Garder les faits cles (CVE, noms d'outils, versions)
//   mais les integrer dans une narration lisible d'un seul souffle.
// whyItMatters : une ou deux phrases max. Commencer par la consequence concrete, puis l'action a retenir.
//   Privilegier "vous" ou "tu" (selon le contexte) plutot que les tournures passives.
const frenchNews: NewsItem[] = [
  {
    id: 'broadcom-velero-cncf-fr',
    publishedAt: '2026-03-24',
    sourceName: 'The New Stack',
    sourceUrl: 'https://thenewstack.io/broadcom-velero-cncf-kubernetes/',
    headline: 'Broadcom donne Velero a la CNCF, rebattant les cartes du backup Kubernetes',
    tldr:
      'Broadcom passe Velero a la CNCF, ce qui en fait un outil de backup Kubernetes desormais gere par la communaute. VKS 3.6 en profite pour laisser choisir son CNI a la creation du cluster et ajoute des profils de performance tout faits pour les bases de donnees et les workloads IA.',
    whyItMatters:
      'Kubernetes n a toujours pas de solution de backup native, donc voir Velero passer sous gouvernance neutre est une vraie bonne nouvelle. Moins de dependance a un editeur, plus de confiance dans la perenite du projet.',
    tags: ['cncf', 'backup', 'open-source', 'velero']
  },
  {
    id: 'trivy-supply-chain-attack-fr',
    publishedAt: '2026-03-23',
    sourceName: 'The Hacker News',
    sourceUrl: 'https://thehackernews.com/2026/03/trivy-hack-spreads-infostealer-via.html',
    headline: 'Attaque supply chain sur Trivy : infostealer Docker et wiper Kubernetes deployés',
    tldr:
      'Des identifiants Aqua Security ont ete voles et des versions piégées de Trivy (0.69.4 a 0.69.6) ont atterri sur Docker Hub avec un stealer dedans. Ces memes credentials ont ensuite servi a propager un ver sur npm, et pour couronner le tout, un wiper s est mis a detruire des clusters Kubernetes en deployant des DaemonSets privilegies sur chaque noeud. CVE-2026-33634, CVSS 9.4.',
    whyItMatters:
      'Un seul compte bot compromis, avec acces a deux orgs GitHub, a suffi pour passer d un scanner compromis a des clusters en production deteuits. Si vous utilisez Trivy en CI/CD, considerez toute execution recente comme suspecte et passez vos Actions en pin par commit SHA.',
    tags: ['security', 'supply-chain', 'docker', 'cve']
  }
]

export function getNewsFeed(lang: NewsLang): NewsItem[] {
  if (lang === 'fr') {
    return frenchNews
  }
  return englishNews
}
