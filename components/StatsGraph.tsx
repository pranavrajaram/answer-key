'use client'

import { useMemo, useState } from 'react'

export type StatsMetricKey =
  | 'balance'
  | 'netWorth'
  | 'totalWagered'
  | 'totalBets'
  | 'marketsWon'
  | 'winRate'

export interface StatsMetricOption {
  key: StatsMetricKey
  label: string
  description: string
  valueFormat: 'number' | 'percent'
}

export interface StatsGraphPoint {
  timestamp: string
  value: number | null
  annotation: 'zero' | 'null' | null
}

export interface StatsGraphSeries {
  userId: string
  username: string
  color: string
  points: StatsGraphPoint[]
}

export interface StatsMetricData {
  option: StatsMetricOption
  series: StatsGraphSeries[]
}

interface StatsGraphProps {
  metrics: StatsMetricData[]
  defaultMetric: StatsMetricKey
}

const CHART_WIDTH = 980
const CHART_HEIGHT = 320
const PADDING_X = 56
const PADDING_TOP = 20
const PADDING_BOTTOM = 36

/** Catmull–Rom style smoothing: cubic Bézier through points (natural tension). */
function smoothPathThroughPoints(points: { x: number; y: number }[]): string {
  if (points.length === 0) return ''
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`
  }

  let d = `M ${points[0].x} ${points[0].y}`
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? 0 : i - 1]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[i + 2] ?? p2
    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = p2.y - (p3.y - p1.y) / 6
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`
  }
  return d
}

/** Build SVG `d` for a series with gaps (null): smooth each contiguous run separately. */
function pathDForSeriesWithGaps(
  seriesPoints: StatsGraphPoint[],
  getX: (index: number) => number,
  getY: (value: number) => number
): string {
  const segments: { x: number; y: number }[][] = []
  let current: { x: number; y: number }[] = []
  seriesPoints.forEach((point, index) => {
    if (point.value === null) {
      if (current.length) {
        segments.push(current)
        current = []
      }
      return
    }
    current.push({ x: getX(index), y: getY(point.value) })
  })
  if (current.length) segments.push(current)

  return segments.map(seg => smoothPathThroughPoints(seg)).join(' ')
}

function formatDateLabel(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

function formatMetricValue(value: number, format: StatsMetricOption['valueFormat']) {
  if (format === 'percent') return `${Math.round(value * 100)}%`
  return Math.round(value).toLocaleString()
}

export default function StatsGraph({ metrics, defaultMetric }: StatsGraphProps) {
  const [selectedMetric, setSelectedMetric] = useState<StatsMetricKey>(defaultMetric)

  const metric = useMemo(() => {
    return metrics.find(item => item.option.key === selectedMetric) ?? metrics[0] ?? null
  }, [metrics, selectedMetric])

  const chartData = useMemo(() => {
    if (!metric) {
      return {
        validSeries: [] as StatsGraphSeries[],
        allSeries: [] as StatsGraphSeries[],
        minY: 0,
        maxY: 1,
        hasPlotData: false,
      }
    }

    const values = metric.series.flatMap(series =>
      series.points.map(point => point.value).filter((value): value is number => value !== null)
    )
    const hasPlotData = values.length > 0
    const min = hasPlotData ? Math.min(...values) : 0
    const max = hasPlotData ? Math.max(...values) : 1
    const span = Math.max(max - min, 1)
    const minY = min - span * 0.08
    const maxY = max + span * 0.08

    return {
      validSeries: metric.series.filter(series => series.points.some(point => point.value !== null)),
      allSeries: metric.series,
      minY,
      maxY,
      hasPlotData,
    }
  }, [metric])

  if (!metric) {
    return null
  }

  const pointCount = metric.series[0]?.points.length ?? 0
  const getX = (index: number) => {
    if (pointCount <= 1) return CHART_WIDTH / 2
    return PADDING_X + (index / (pointCount - 1)) * (CHART_WIDTH - PADDING_X * 2)
  }
  const getY = (value: number) => {
    const ratio = (value - chartData.minY) / (chartData.maxY - chartData.minY || 1)
    return CHART_HEIGHT - PADDING_BOTTOM - ratio * (CHART_HEIGHT - PADDING_BOTTOM - PADDING_TOP)
  }

  return (
    <section className="ak-card p-4 sm:p-5 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">Performance trend</h2>
          <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">{metric.option.description}</p>
        </div>
        <label className="flex items-center gap-2 text-xs text-stone-600 dark:text-stone-400">
          Metric
          <select
            value={metric.option.key}
            onChange={event => setSelectedMetric(event.target.value as StatsMetricKey)}
            className="rounded-xl border border-stone-300/80 bg-white/90 px-2.5 py-1.5 text-sm text-stone-700 focus:border-teal-600 focus:outline-none focus:ring-4 focus:ring-teal-600/10 dark:border-stone-600/70 dark:bg-stone-900/75 dark:text-stone-200 dark:focus:border-teal-400 dark:focus:ring-teal-500/15"
          >
            {metrics.map(item => (
              <option key={item.option.key} value={item.option.key}>
                {item.option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="rounded-2xl border border-stone-200/70 bg-stone-50/70 p-2 sm:p-3 dark:border-stone-700/60 dark:bg-stone-900/40">
        <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} role="img" aria-label={`${metric.option.label} chart`} className="w-full h-[260px]">
          <line
            x1={PADDING_X}
            x2={CHART_WIDTH - PADDING_X}
            y1={CHART_HEIGHT - PADDING_BOTTOM}
            y2={CHART_HEIGHT - PADDING_BOTTOM}
            stroke="var(--ak-chart-line)"
            strokeWidth="1"
          />
          <line
            x1={PADDING_X}
            x2={PADDING_X}
            y1={PADDING_TOP}
            y2={CHART_HEIGHT - PADDING_BOTTOM}
            stroke="var(--ak-chart-line)"
            strokeWidth="1"
          />

          {chartData.hasPlotData &&
            chartData.validSeries.map(series => {
              const path = pathDForSeriesWithGaps(series.points, getX, getY)

              const lastVisible = [...series.points]
                .map((point, index) => ({ point, index }))
                .reverse()
                .find(item => item.point.value !== null)

              return (
                <g key={series.userId}>
                  <path
                    d={path}
                    fill="none"
                    stroke={series.color}
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {lastVisible && lastVisible.point.value !== null && (
                    <circle
                      cx={getX(lastVisible.index)}
                      cy={getY(lastVisible.point.value)}
                      r="3.5"
                      fill={series.color}
                      stroke="var(--ak-chart-marker-ring)"
                      strokeWidth="1.5"
                    />
                  )}
                </g>
              )
            })}

          {!chartData.hasPlotData && (
            <text x={CHART_WIDTH / 2} y={CHART_HEIGHT / 2} textAnchor="middle" fill="var(--ak-chart-text)" fontSize="16">
              No plottable points yet for this metric
            </text>
          )}

          {pointCount > 0 && (
            <>
              <text x={PADDING_X} y={CHART_HEIGHT - 10} fontSize="11" fill="var(--ak-chart-text)" textAnchor="start">
                {formatDateLabel(metric.series[0].points[0].timestamp)}
              </text>
              <text x={CHART_WIDTH - PADDING_X} y={CHART_HEIGHT - 10} fontSize="11" fill="var(--ak-chart-text)" textAnchor="end">
                {formatDateLabel(metric.series[0].points[pointCount - 1].timestamp)}
              </text>
            </>
          )}
        </svg>
      </div>

      <div className="flex flex-wrap gap-2">
        {chartData.allSeries.map(series => {
          const hiddenZeros = series.points.filter(point => point.annotation === 'zero').length
          const hiddenNulls = series.points.filter(point => point.annotation === 'null').length
          const latestVisible = [...series.points]
            .map((point, index) => ({ point, index }))
            .reverse()
            .find(item => item.point.value !== null)

          return (
            <div
              key={series.userId}
              className="rounded-xl border border-stone-200/80 bg-white/80 px-3 py-2 text-xs text-stone-600 dark:border-stone-700/60 dark:bg-stone-900/45 dark:text-stone-400"
            >
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: series.color }} aria-hidden="true" />
                <span className="font-medium text-stone-700 dark:text-stone-200">{series.username}</span>
                <span className="text-stone-400 dark:text-stone-500">
                  {latestVisible && latestVisible.point.value !== null
                    ? formatMetricValue(latestVisible.point.value, metric.option.valueFormat)
                    : '—'}
                </span>
              </div>
              {(hiddenZeros > 0 || hiddenNulls > 0) && (
                <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-400/90">
                  Hidden points: {hiddenZeros > 0 ? `${hiddenZeros} zero` : ''}
                  {hiddenZeros > 0 && hiddenNulls > 0 ? ', ' : ''}
                  {hiddenNulls > 0 ? `${hiddenNulls} null` : ''}
                </p>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
