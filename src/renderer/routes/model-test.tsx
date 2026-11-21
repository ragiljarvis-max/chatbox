import { Badge, Box, Button, Card, Center, Flex, Group, Loader, Modal, NumberInput, Progress, SegmentedControl, ScrollArea, Select, Stack, Text, Title, UnstyledButton } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { IconActivity, IconFlask, IconPlayerPlay, IconRefresh } from '@tabler/icons-react'
import { createFileRoute } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Page from '@/components/layout/Page'
import { ScalableIcon } from '@/components/common/ScalableIcon'
import { useIsSmallScreen } from '@/hooks/useScreenChange'
import { useProviders } from '@/hooks/useProviders'
import {
  filterAndSortResults,
  pingProvidersBatch,
  runSingleModelTests,
  type ModelResultFilter,
  type PingTarget,
  type ProviderTestResult,
  type TestKind,
} from '@/utils/provider-health'

export const Route = createFileRoute('/model-test')({
  component: ModelTestRoute,
})

const resultKey = (providerId: string, modelId: string, kind: string) => `${providerId}::${modelId}::${kind}`

const TEST_KIND_OPTIONS: { label: string; value: string }[] = [
  { label: 'Ping', value: 'ping' },
  { label: 'Vision', value: 'vision' },
  { label: 'Context', value: 'context' },
  { label: 'All', value: 'all' },
]

function StatCard(props: {
  label: string
  value: string
  color: string
  onClick?: () => void
  testId?: string
}) {
  const body = (
    <Card
      withBorder
      radius="md"
      py="sm"
      px="md"
      className={
        props.onClick
          ? 'cursor-pointer transition-transform hover:scale-[1.02] hover:shadow-md'
          : undefined
      }
    >
      <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
        {props.label}
      </Text>
      <Text size="xl" fw={700} c={props.color} data-testid={props.testId}>
        {props.value}
      </Text>
    </Card>
  )
  return props.onClick ? (
    <UnstyledButton onClick={props.onClick} className="flex-1">
      {body}
    </UnstyledButton>
  ) : (
    <Box className="flex-1">{body}</Box>
  )
}

function StatusBadge({ status }: { status: 'alive' | 'dead' | 'pending' }) {
  const { t } = useTranslation()
  if (status === 'alive') {
    return (
      <Badge color="teal" variant="light" fw={700}>
        ALIVE
      </Badge>
    )
  }
  if (status === 'dead') {
    return (
      <Badge color="red" variant="light" fw={700}>
        DEAD
      </Badge>
    )
  }
  return (
    <Badge color="gray" variant="light">
      {t('Not tested')}
    </Badge>
  )
}

function ModelTestRoute() {
  const { t } = useTranslation()
  const isSmallScreen = useIsSmallScreen()
  const { providers } = useProviders()
  const [maxRpm, setMaxRpm] = useState<number | ''>(30)
  const [running, setRunning] = useState(false)
  const [results, setResults] = useState<Record<string, ProviderTestResult>>({})
  const [selectedKinds, setSelectedKinds] = useState<Record<string, string>>({})
  const [testingKeys, setTestingKeys] = useState<Record<string, boolean>>({})
  const [filter, setFilter] = useState<ModelResultFilter>('all')
  const [detailOpen, detailHandlers] = useDisclosure(false)

  const targets = useMemo(
    () =>
      providers.flatMap((p) =>
        (p.models || []).map((m) => ({ providerId: p.id, modelId: m.modelId }))
      ),
    [providers]
  )

  const resultList = useMemo(() => Object.values(results), [results])
  const doneCount = useMemo(
    () => new Set(resultList.map((r) => `${r.providerId}::${r.modelId}`)).size,
    [resultList]
  )
  const totalCount = targets.length
  const aliveCount = useMemo(
    () => new Set(resultList.filter((r) => r.status === 'alive').map((r) => `${r.providerId}::${r.modelId}`)).size,
    [resultList]
  )
  const deadCount = doneCount - aliveCount

  const pingAll = async () => {
    if (running) return
    if (targets.length === 0) return
    setRunning(true)
    setResults({})
    try {
      await pingProvidersBatch(
        targets,
        typeof maxRpm === 'number' ? maxRpm : 30,
        (result) => {
          setResults((prev) => ({ ...prev, [resultKey(result.providerId, result.modelId, result.kind)]: result }))
        },
        () => false
      )
    } finally {
      setRunning(false)
    }
  }

  const modelKeyOf = (target: PingTarget) => `${target.providerId}::${target.modelId}`

  const testOne = async (target: PingTarget) => {
    const mKey = modelKeyOf(target)
    if (testingKeys[mKey] || running) return
    const sel = selectedKinds[mKey] || 'ping'
    const kinds: TestKind[] = sel === 'all' ? ['ping', 'vision', 'context'] : [sel as TestKind]
    setTestingKeys((prev) => ({ ...prev, [mKey]: true }))
    try {
      await runSingleModelTests(target, kinds, (result) => {
        setResults((prev) => ({ ...prev, [resultKey(result.providerId, result.modelId, result.kind)]: result }))
      })
    } finally {
      setTestingKeys((prev) => ({ ...prev, [mKey]: false }))
    }
  }

  const providerName = (providerId: string) => providers.find((p) => p.id === providerId)?.name || providerId
  const visibleResults = useMemo(() => filterAndSortResults(resultList, filter), [resultList, filter])

  return (
    <Page title={t('Model Test')}>
      <Stack gap="md" p={isSmallScreen ? 'sm' : 'md'} maw={720} mx="auto">
        <Flex align="center" gap="sm">
          <ScalableIcon icon={IconFlask} size={28} />
          <Title order={isSmallScreen ? 4 : 3}>{t('Model Test')}</Title>
        </Flex>

        {targets.length === 0 ? (
          <Card withBorder radius="md" p="xl">
            <Stack align="center" gap="xs">
              <ScalableIcon icon={IconActivity} size={32} color="dimmed" />
              <Text size="sm" c="dimmed">
                {t('No models configured. Add a provider with models to test them here.')}
              </Text>
            </Stack>
          </Card>
        ) : (
          <>
            <Group gap="sm" align="flex-end">
              <NumberInput
                value={maxRpm}
                onChange={(value) => setMaxRpm(typeof value === 'number' ? value : '')}
                min={1}
                max={600}
                w={110}
                size="xs"
                label={t('Max RPM')}
                data-testid="model-test-max-rpm"
              />
              <Button
                size="xs"
                leftSection={<ScalableIcon icon={IconRefresh} size={14} />}
                onClick={pingAll}
                loading={running}
                data-testid="model-test-ping-all"
              >
                {t('Ping all')}
              </Button>
              <Text size="xs" c="dimmed" flex={1} ta="right">
                {t('{{count}}/{{total}} models', { count: doneCount, total: totalCount })}
              </Text>
            </Group>

            {running && (
              <Progress value={totalCount > 0 ? (doneCount / totalCount) * 100 : 0} animated size="sm" radius="md" />
            )}

            <Group gap="sm" grow>
              <StatCard
                label={t('Total')}
                value={String(totalCount)}
                color="var(--mantine-color-text)"
                testId="model-test-total"
              />
              <StatCard
                label={t('Alive')}
                value={`${aliveCount} of ${totalCount}`}
                color="teal"
                onClick={() => {
                  setFilter('alive')
                  detailHandlers.open()
                }}
                testId="model-test-alive"
              />
              <StatCard
                label={t('Dead')}
                value={`${deadCount} of ${totalCount}`}
                color="red"
                onClick={() => {
                  setFilter('dead')
                  detailHandlers.open()
                }
                }
                testId="model-test-dead"
              />
            </Group>

            {doneCount > 0 && (
              <Text size="xs" c="dimmed">
                {t('Tap a summary card to see per-model details.')}
              </Text>
            )}

            <Stack gap="xs">
              {targets.map((target) => {
                const mKey = modelKeyOf(target)
                const modelResults = resultList.filter((r) => r.providerId === target.providerId && r.modelId === target.modelId)
                return (
                  <Card key={mKey} withBorder radius="md" py="xs" px="sm">
                    <Flex justify="space-between" align="center" gap="xs" wrap="wrap">
                      <Box miw={0} style={{ overflow: 'hidden', flex: 1 }}>
                        <Text size="sm" truncate>
                          {providerName(target.providerId)} · {target.modelId}
                        </Text>
                        {modelResults.length > 0 && (
                          <Text size="xs" c="dimmed">
                            {modelResults
                              .map((r) => `${r.kind.toUpperCase()} ${r.status === 'alive' ? 'PASS' : 'FAIL'}${r.latencyMs !== undefined ? ` ${r.latencyMs}ms${r.tokensPerSecond !== undefined ? ` ${r.tokensPerSecond}tok/s` : ''}` : ''}`)
                              .join(' · ')}
                          </Text>
                        )}
                      </Box>
                      <Group gap="xs">
                        <Select
                          size="xs"
                          w={120}
                          data={TEST_KIND_OPTIONS}
                          value={selectedKinds[mKey] || 'ping'}
                          onChange={(value) =>
                            setSelectedKinds((prev) => ({ ...prev, [mKey]: value || 'ping' }))
                          }
                          data-testid={`model-test-kind-${mKey}`}
                        />
                        <Button
                          size="xs"
                          leftSection={<ScalableIcon icon={IconPlayerPlay} size={14} />}
                          onClick={() => testOne(target)}
                          loading={!!testingKeys[mKey]}
                          data-testid={`model-test-run-${mKey}`}
                        >
                          {t('Test')}
                        </Button>
                      </Group>
                    </Flex>
                  </Card>
                )
              })}
            </Stack>
          </>
        )}

        <Modal
          opened={detailOpen}
          onClose={detailHandlers.close}
          title={
            <Text fw={600}>
              {t('Model Test Results')} — {t('{{alive}} alive, {{dead}} dead of {{total}}', { alive: aliveCount, dead: deadCount, total: totalCount })}
            </Text>
          }
          fullScreen={isSmallScreen}
          size="lg"
        >
          <Stack gap="sm" mah="70vh">
            <SegmentedControl
              fullWidth
              value={filter}
              onChange={(value) => setFilter(value as ModelResultFilter)}
              data={[
                { label: t('All'), value: 'all' },
                { label: t('Alive'), value: 'alive' },
                { label: t('Dead'), value: 'dead' },
              ]}
              data-testid="model-test-filter"
            />
            <ScrollArea style={{ flex: 1 }} offsetScrollbars>
              <Stack gap="xs">
                {visibleResults.length === 0 ? (
                  <Center py="md">
                    <Text size="sm" c="dimmed">
                      {doneCount === 0 ? t('Nothing tested yet. Tap "Ping all".') : t('No results match this filter.')}
                    </Text>
                  </Center>
                ) : (
                  visibleResults.map((r) => (
                    <Card key={resultKey(r.providerId, r.modelId, r.kind)} withBorder radius="md" py="xs" px="sm">
                      <Flex justify="space-between" align="center" gap="xs">
                        <Box miw={0} style={{ overflow: 'hidden' }}>
                          <Text size="sm" truncate>
                            {providerName(r.providerId)} · {r.modelId}
                          </Text>
                          <Text size="xs" c="dimmed">
                            {r.kind.toUpperCase()} ·{' '}
                            {r.status === 'alive' && r.latencyMs !== undefined
                              ? `${r.latencyMs} ms · ${r.tokensPerSecond ?? '—'} tok/s`
                              : (r.error || '').slice(0, 80)}
                          </Text>
                        </Box>
                        <StatusBadge status={r.status} />
                      </Flex>
                    </Card>
                  ))
                )}
              </Stack>
            </ScrollArea>
            {running && (
              <Center>
                <Group gap="xs">
                  <Loader size="xs" />
                  <Text size="xs" c="dimmed">
                    {t('{{count}}/{{total}} models', { count: doneCount, total: totalCount })}
                  </Text>
                </Group>
              </Center>
            )}
          </Stack>
        </Modal>
      </Stack>
    </Page>
  )
}
