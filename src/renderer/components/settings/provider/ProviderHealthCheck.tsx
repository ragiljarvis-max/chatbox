import { Button, NumberInput, Text } from '@mantine/core'
import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import type { ProviderInfo } from '@shared/types'
import { pingProvidersBatch, type ProviderHealthResult } from '@/utils/provider-health'

interface ProviderHealthCheckProps {
  providers: ProviderInfo[]
}

export function ProviderHealthCheck({ providers }: ProviderHealthCheckProps) {
  const { t } = useTranslation()
  const [maxRpm, setMaxRpm] = useState<number | ''>(30)
  const [running, setRunning] = useState(false)
  const [results, setResults] = useState<Record<string, ProviderHealthResult>>({})

  const resultsKey = (providerId: string, modelId: string) => `${providerId}::${modelId}`

  const pingAll = async () => {
    if (running) return
    const targets = providers.flatMap((p) => {
      const model = p.models?.[0]
      return model ? [{ providerId: p.id, modelId: model.modelId }] : []
    })
    if (targets.length === 0) return
    setRunning(true)
    setResults({})
    try {
      await pingProvidersBatch(
        targets,
        typeof maxRpm === 'number' ? maxRpm : 30,
        (result) => {
          setResults((prev) => ({ ...prev, [resultsKey(result.providerId, result.modelId)]: result }))
        },
        () => false
      )
    } finally {
      setRunning(false)
    }
  }

  const doneCount = Object.keys(results).length

  return (
    <div data-testid="provider-health-check">
      <div className="flex items-center gap-2 p-2">
        <NumberInput
          value={maxRpm}
          onChange={(value) => setMaxRpm(typeof value === 'number' ? value : '')}
          min={1}
          max={600}
          w={90}
          size="xs"
          label={t('Max RPM')}
          data-testid="provider-health-max-rpm"
        />
        <Button size="xs" onClick={pingAll} loading={running} data-testid="provider-health-ping-all">
          {t('Ping all')}
        </Button>
        {running && (
          <Text span size="xs" c="dimmed">
            {t('{{count}}/{{total}} checked', { count: doneCount, total: providers.length })}
          </Text>
        )}
      </div>
      <div className="flex flex-col gap-1 px-2 pb-2">
        {providers.map((p) => {
          const model = p.models?.[0]
          const result = model ? results[resultsKey(p.id, model.modelId)] : undefined
          return (
            <div key={p.id} className="flex items-center gap-2 text-xs">
              <Text span size="xs" className="truncate flex-1" c="dimmed">
                {t(p.name)}
              </Text>
              {!result ? null : result.status === 'alive' ? (
                <Text span size="xs" c="teal" data-testid={`provider-health-${p.id}`}>
                  ALIVE · {result.latencyMs} ms · {result.tokensPerSecond} tok/s
                </Text>
              ) : (
                <Text span size="xs" c="red" data-testid={`provider-health-${p.id}`}>
                  DEAD{result.error ? ` · ${result.error.slice(0, 60)}` : ''}
                </Text>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
