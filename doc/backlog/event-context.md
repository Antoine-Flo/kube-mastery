# Refactoring EventBus : EventBus Global via Context + Subclassing Event

## Objectif

Refactorer le système d'événements pour :

1. **Créer un EventBus global accessible via Context** (Option 3)
2. **Utiliser des sous-classes d'Event natif** au lieu de CustomEvent ou d'interfaces TypeScript
3. **Simplifier la communication Terminal → Quiz** en remplaçant les callbacks en chaîne par des événements

## Problèmes actuels

### 1. Callbacks en chaîne (Terminal → Page → Quiz)

- **Couplage fort** : Terminal dépend de la Page, qui dépend du Quiz
- **Fragile** : Si un maillon manque, tout casse
- **Redondant** : Les commandes sont loggées mais pas émises comme événements
- **Pas cohérent** : L'EventBus existe déjà pour Kubernetes/Filesystem, mais pas pour les commandes terminal

### 2. EventBus actuel utilise des interfaces TypeScript

- Les événements sont des objets plain avec `type`, `timestamp`, `payload`
- Pas de typage fort au niveau du navigateur
- Pas d'intégration avec les événements natifs du DOM

## Solution proposée

### 1. EventBus Global via Context

Créer un Context SolidJS pour partager l'EventBus globalement :

```typescript
// src/components/contexts/EventBusContext.tsx
import { createContext, useContext } from 'solid-js'
import { createEventBus, type EventBus } from '~/core/cluster/events/EventBus'

const EventBusContext = createContext<EventBus>()

export const useGlobalEventBus = () => {
    const bus = useContext(EventBusContext)
    if (!bus) {
        throw new Error('EventBusContext not found')
    }
    return bus
}

export interface EventBusProviderProps {
    children: JSX.Element
    value: EventBus
}

export const EventBusProvider: Component<EventBusProviderProps> = (props) => {
    return <EventBusContext.Provider value={props.value}>{props.children}</EventBusContext.Provider>
}
```

**Utilisation dans app.tsx :**

```typescript
const globalEventBus = createEventBus()

<EventBusProvider value={globalEventBus}>
    {/* app */}
</EventBusProvider>
```

### 2. Subclassing Event natif

Au lieu d'utiliser des interfaces TypeScript, créer des sous-classes d'Event :

```typescript
// src/core/terminal/events/TerminalCommandExecutedEvent.ts
/**
 * Event fired when a command is executed in the terminal.
 * Used by Quiz component to validate terminal commands.
 */
export class TerminalCommandExecutedEvent extends Event {
  static readonly eventName = 'terminal-command-executed'

  readonly command: string
  readonly source: 'terminal' = 'terminal'
  readonly timestamp: string

  constructor(command: string) {
    super(TerminalCommandExecutedEvent.eventName, {
      bubbles: true,
      composed: true
    })
    this.command = command
    this.timestamp = new Date().toISOString()
  }
}

// Enregistrer globalement pour le typage automatique
declare global {
  interface GlobalEventHandlersEventMap {
    'terminal-command-executed': TerminalCommandExecutedEvent
  }
}
```

**Avantages :**

- ✅ **Typage fort** : TypeScript connaît automatiquement le type dans `addEventListener`
- ✅ **Documentation intégrée** : JSDoc directement sur la classe
- ✅ **Source de vérité unique** : Le constructeur garantit la cohérence
- ✅ **Sensation native** : Se comporte comme un événement DOM natif
- ✅ **Plus simple** : Pas besoin de `CustomEvent<DetailType>`

### 3. Refactoring EventBus pour supporter Event natif

L'EventBus actuel utilise des interfaces. Il faut l'adapter pour supporter à la fois :

- Les anciens événements (interfaces) pour la rétrocompatibilité
- Les nouveaux événements (sous-classes d'Event) pour le futur

**Option A : Dual support (recommandé pour migration progressive)**

```typescript
export interface EventBus {
  emit: (event: AppEvent | Event) => void
  subscribe: <T extends AppEvent | Event>(eventType: string, subscriber: (event: T) => void) => UnsubscribeFn
  // ... autres méthodes
}
```

**Option B : Migration complète vers Event natif**

- Refactorer tous les événements existants (PodCreated, etc.) en sous-classes d'Event
- Plus de travail mais plus cohérent

### 4. Utilisation pour le Quiz

**Avant (callbacks en chaîne) :**

```typescript
// Terminal → handleTerminalCommand → quizCommandHandler
const handleTerminalCommand = (command: string) => {
  if (quizCommandHandler) {
    quizCommandHandler(command)
  }
}
```

**Après (EventBus global) :**

```typescript
// Dans InputHandler.ts - Émettre l'événement
const event = new TerminalCommandExecutedEvent(command)
eventBus.emit(event)

// Dans Quiz.tsx - S'abonner à l'événement
createEffect(() => {
  const bus = useGlobalEventBus()

  const unsubscribe = bus.subscribe('terminal-command-executed', (event: TerminalCommandExecutedEvent) => {
    const question = currentQuestion()
    if (!question || question.type !== 'terminal-command') {
      return
    }

    const isValid = validateCommand(question, event.command)
    // ... validation logic
  })

  onCleanup(() => unsubscribe())
})
```

## Plan de migration

### Phase 1 : Créer l'EventBus global et le Context

- [ ] Créer `src/components/contexts/EventBusContext.tsx`
- [ ] Ajouter `EventBusProvider` dans `app.tsx`
- [ ] Tester l'accès via `useGlobalEventBus()`

### Phase 2 : Créer les événements Terminal avec subclassing

- [ ] Créer `src/core/terminal/events/TerminalCommandExecutedEvent.ts`
- [ ] Ajouter le type dans `GlobalEventHandlersEventMap`
- [ ] Tester l'émission/réception

### Phase 3 : Refactorer EventBus pour supporter Event natif

- [ ] Modifier l'interface `EventBus` pour accepter `Event | AppEvent`
- [ ] Adapter la logique interne (historique, filtrage)
- [ ] Tester la rétrocompatibilité avec les anciens événements

### Phase 4 : Migrer Terminal → Quiz

- [ ] Émettre `TerminalCommandExecutedEvent` dans `InputHandler.handleEnter()`
- [ ] S'abonner dans `Quiz.tsx` via `useGlobalEventBus()`
- [ ] Supprimer les callbacks `onCommandHandlerReady`, `handleTerminalCommand`
- [ ] Tester le flux complet

### Phase 5 : Nettoyage

- [ ] Supprimer les props `onCommand` inutiles
- [ ] Supprimer `quizCommandHandler` et les setters associés
- [ ] Mettre à jour la documentation

## Exemples d'utilisation

### Émettre un événement

```typescript
import { useGlobalEventBus } from '~/components/contexts/EventBusContext'
import { TerminalCommandExecutedEvent } from '~/core/terminal/events/TerminalCommandExecutedEvent'

const eventBus = useGlobalEventBus()
const event = new TerminalCommandExecutedEvent('kubectl get pods')
eventBus.emit(event)
```

### S'abonner à un événement

```typescript
import { useGlobalEventBus } from '~/components/contexts/EventBusContext'
import { TerminalCommandExecutedEvent } from '~/core/terminal/events/TerminalCommandExecutedEvent'

const eventBus = useGlobalEventBus()

createEffect(() => {
  const unsubscribe = eventBus.subscribe('terminal-command-executed', (event: TerminalCommandExecutedEvent) => {
    console.log('Command executed:', event.command)
  })

  onCleanup(() => unsubscribe())
})
```

### Utilisation avec addEventListener (si on utilise window)

```typescript
// Si on dispatch sur window au lieu de l'EventBus
window.addEventListener('terminal-command-executed', (e: TerminalCommandExecutedEvent) => {
  // TypeScript connaît automatiquement le type !
  const { command, timestamp } = e
})
```

## Avantages de cette approche

1. **Découplage** : Le Quiz s'abonne directement, pas de chaîne de callbacks
2. **Cohérence** : Même pattern que les événements Kubernetes (mais avec Event natif)
3. **Historique** : Les commandes sont dans l'historique de l'EventBus
4. **Extensible** : D'autres composants peuvent s'abonner facilement (visualisation, logs, etc.)
5. **Testable** : Plus facile à tester avec l'EventBus
6. **Typage fort** : TypeScript + événements natifs = meilleure DX
7. **Documentation** : JSDoc directement sur les classes d'événements

## Cas d'usage futurs

- **Visualisation** : S'abonner aux commandes pour afficher un historique visuel
- **Analytics** : Logger toutes les commandes exécutées
- **Auto-complétion** : Analyser les commandes pour améliorer l'autocomplétion
- **Debugging** : Time-travel debugging avec l'historique des événements

## Références

- [Subclassing Event (article)](https://www.bitovi.com/blog/customevent-is-a-code-smell)
- [SolidJS Context](https://www.solidjs.com/docs/latest/api#createcontext)
- [MDN Event](https://developer.mozilla.org/en-US/docs/Web/API/Event)
- [MDN CustomEvent](https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent)
