import { describe, expect, it } from 'vitest'
import { createEndpointSlice } from '~/core/cluster/ressources/EndpointSlice'
import { createEndpoints } from '~/core/cluster/ressources/Endpoints'
import { createEvent } from '~/core/cluster/ressources/Event'
import { createNetworkPolicy } from '~/core/cluster/ressources/NetworkPolicy'
import { createPersistentVolume } from '~/core/cluster/ressources/PersistentVolume'
import { createPersistentVolumeClaim } from '~/core/cluster/ressources/PersistentVolumeClaim'
import {
  hasResourceHandler,
  RESOURCE_HANDLERS
} from '~/core/kubectl/commands/handlers/internal/get/resourceHandlers'

describe('resourceHandlers', () => {
  it('formats EndpointSlice rows with unset ports and missing endpoints', () => {
    const endpointSlice = createEndpointSlice({
      name: 'api-slice',
      namespace: 'default',
      addressType: 'IPv4',
      ports: [{ protocol: 'TCP' }],
      endpoints: []
    })

    const row = RESOURCE_HANDLERS.endpointslices.formatRow(endpointSlice)
    expect(row[0]).toBe('api-slice')
    expect(row[2]).toContain('<unset>')
    expect(row[3]).toBe('<none>')
  })

  it('formats Endpoints rows with address and port pairs', () => {
    const endpoints = createEndpoints({
      name: 'api',
      namespace: 'default',
      subsets: [
        {
          addresses: [{ ip: '10.0.0.10' }],
          ports: [{ port: 443, protocol: 'TCP' }]
        }
      ]
    })

    const row = RESOURCE_HANDLERS.endpoints.formatRow(endpoints)
    expect(row[0]).toBe('api')
    expect(row[1]).toContain('10.0.0.10:443')
  })

  it('sorts events by lastTimestamp descending then name', () => {
    const baseTs = '2026-03-31T10:00:00.000Z'
    const newerTs = '2026-03-31T10:05:00.000Z'
    const eventA = createEvent({
      name: 'aaa',
      namespace: 'default',
      involvedObject: { kind: 'Pod', name: 'p1', namespace: 'default' },
      reason: 'Test',
      message: 'a',
      lastTimestamp: baseTs
    })
    const eventB = createEvent({
      name: 'bbb',
      namespace: 'default',
      involvedObject: { kind: 'Pod', name: 'p1', namespace: 'default' },
      reason: 'Test',
      message: 'b',
      lastTimestamp: baseTs
    })
    const eventNew = createEvent({
      name: 'new',
      namespace: 'default',
      involvedObject: { kind: 'Pod', name: 'p2', namespace: 'default' },
      reason: 'Test',
      message: 'new',
      lastTimestamp: newerTs
    })

    const sorted = RESOURCE_HANDLERS.events.getItems({
      events: { items: [eventB, eventA, eventNew] }
    } as never)

    expect(sorted[0].metadata.name).toBe('new')
    expect(sorted[1].metadata.name).toBe('aaa')
    expect(sorted[2].metadata.name).toBe('bbb')
  })

  it('formats NetworkPolicy pod selector labels and expressions', () => {
    const policy = createNetworkPolicy({
      name: 'deny-all',
      namespace: 'default',
      spec: {
        podSelector: {
          matchLabels: { app: 'web', tier: 'frontend' },
          matchExpressions: [
            { key: 'track', operator: 'In', values: ['stable', 'canary'] },
            null as never
          ]
        },
        policyTypes: ['Ingress']
      }
    })

    const row = RESOURCE_HANDLERS.networkpolicies.formatRow(policy)
    expect(row[1]).toContain('app=web')
    expect(row[1]).toContain('tier=frontend')
    expect(row[1]).toContain('track In (stable,canary)')
  })

  it('formats PersistentVolume and PersistentVolumeClaim bound details', () => {
    const persistentVolume = createPersistentVolume({
      name: 'pv-a',
      spec: {
        capacity: { storage: '10Gi' },
        accessModes: ['ReadWriteOncePod', 'ReadOnlyMany'],
        storageClassName: 'standard',
        claimRef: { namespace: 'default', name: 'claim-a' }
      }
    })
    const pvRow = RESOURCE_HANDLERS.persistentvolumes.formatRow(persistentVolume)
    expect(pvRow[2]).toBe('RWOP,ROX')
    expect(pvRow[4]).toBe('Bound')
    expect(pvRow[5]).toBe('default/claim-a')

    const pvc = createPersistentVolumeClaim({
      name: 'claim-a',
      namespace: 'default',
      spec: {
        accessModes: ['ReadWriteOnce'],
        resources: { requests: { storage: '10Gi' } },
        storageClassName: 'standard',
        volumeName: 'pv-a'
      },
      status: {
        phase: 'Bound',
        accessModes: ['ReadWriteOnce'],
        capacity: { storage: '10Gi' }
      }
    })
    const pvcRow = RESOURCE_HANDLERS.persistentvolumeclaims.formatRow(pvc)
    expect(pvcRow[1]).toBe('Bound')
    expect(pvcRow[2]).toBe('pv-a')
    expect(pvcRow[3]).toBe('10Gi')
    expect(pvcRow[4]).toBe('RWO')
  })

  it('validates handler existence checks', () => {
    expect(hasResourceHandler('pods')).toBe(true)
    expect(hasResourceHandler('unknown-resource')).toBe(false)
  })
})
