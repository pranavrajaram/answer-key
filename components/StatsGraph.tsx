'use client'

import { useMemo, useState } from 'react'

export type StatsMetricKey =
  | 'balance'
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
    <section className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-gray-800">Performance trend</h2>
          <p className="text-xs text-gray-500 mt-1">{metric.option.description}</p>
        </div>
        <label className="text-xs text-gray-600 flex items-center gap-2">
          Metric
          <select
            value={metric.option.key}
            onChange={event => setSelectedMetric(event.target.value as StatsMetricKey)}
            className="rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500"
          >
            {metrics.map(item => (
              <option key={item.option.key} value={item.option.key}>
                {item.option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-2 sm:p-3">
        <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} role="img" aria-label={`${metric.option.label} chart`} className="w-full h-[260px]">
          <line
            x1={PADDING_X}
            x2={CHART_WIDTH - PADDING_X}
            y1={CHART_HEIGHT - PADDING_BOTTOM}
            y2={CHART_HEIGHT - PADDING_BOTTOM}
            stroke="#d1d5db"
            strokeWidth="1"
          />
          <line
            x1={PADDING_X}
            x2={PADDING_X}
            y1={PADDING_TOP}
            y2={CHART_HEIGHT - PADDING_BOTTOM}
            stroke="#d1d5db"
            strokeWidth="1"
          />

          {chartData.hasPlotData &&
            chartData.validSeries.map(series => {
              let drawing = false
              let path = ''

              series.points.forEach((point, index) => {
                if (point.value === null) {
                  drawing = false
                  return
                }
                const x = getX(index)
                const y = getY(point.value)
                path += drawing ? ` L ${x} ${y}` : ` M ${x} ${y}`
                drawing = true
              })

              const lastVisible = [...series.points]
                .map((point, index) => ({ point, index }))
                .reverse()
                .find(item => item.point.value !== null)

              return (
                <g key={series.userId}>
                  <path d={path.trim()} fill="none" stroke={series.color} strokeWidth="2.4" strokeLinecap="round" />
                  {lastVisible && lastVisible.point.value !== null && (
                    <circle
                      cx={getX(lastVisible.index)}
                      cy={getY(lastVisible.point.value)}
                      r="3.5"
                      fill={series.color}
                      stroke="white"
                      strokeWidth="1.5"
                    />
                  )}
                </g>
              )
            })}

          {!chartData.hasPlotData && (
            <text x={CHART_WIDTH / 2} y={CHART_HEIGHT / 2} textAnchor="middle" fill="#6b7280" fontSize="16">
              No plottable points yet for this metric
            </text>
          )}

          {pointCount > 0 && (
            <>
              <text x={PADDING_X} y={CHART_HEIGHT - 10} fontSize="11" fill="#6b7280" textAnchor="start">
                {formatDateLabel(metric.series[0].points[0].timestamp)}
              </text>
              <text x={CHART_WIDTH - PADDING_X} y={CHART_HEIGHT - 10} fontSize="11" fill="#6b7280" textAnchor="end">
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
            <div key={series.userId} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-600">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: series.color }} aria-hidden="true" />
                <span className="font-medium text-gray-700">{series.username}</span>
                <span className="text-gray-400">
                  {latestVisible && latestVisible.point.value !== null
                    ? formatMetricValue(latestVisible.point.value, metric.option.valueFormat)
                    : '—'}
                </span>
              </div>
              {(hiddenZeros > 0 || hiddenNulls > 0) && (
                <p className="mt-1 text-[11px] text-amber-700">
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
