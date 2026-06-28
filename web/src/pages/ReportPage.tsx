import { FilterBar } from '../components/FilterBar'
import { ParseStatusBadge } from '../components/ParseStatusBadge'
import { BillingDonut } from '../components/charts/BillingDonut'
import { CacheHitChart } from '../components/charts/CacheHitChart'
import { ChartPanel } from '../components/charts/ChartPanel'
import { DailyChart } from '../components/charts/DailyChart'
import { ExportPngButton } from '../components/charts/ExportPngButton'
import { HourlyChart, WeeklyHeatmap } from '../components/charts/ActivityCharts'
import { KpiCards } from '../components/charts/KpiCards'
import { ModelChart } from '../components/charts/ModelChart'
import { PoolDonut } from '../components/charts/PoolDonut'
import { PoolProjection } from '../components/charts/PoolProjection'
import { TokenStructureChart } from '../components/charts/TokenStructureChart'
import { UnitPriceChart } from '../components/charts/UnitPriceChart'
import { YearHeatmap } from '../components/charts/YearHeatmap'
import { useReport } from '../hooks/useReport'
import '../styles/report.css'

export function ReportPage() {
  const {
    fileName,
    meta,
    rowCount,
    filters,
    poolLimits,
    modelView,
    structureView,
    hourlyView,
    dailyActivityGranularity,
    weeklyActivityGranularity,
    projectionOpen,
    allModels,
    heatmapVisible,
    agg,
    clear,
    setFilters,
    setPoolLimits,
    setModelView,
    setStructureView,
    setHourlyView,
    setDailyActivityGranularity,
    setWeeklyActivityGranularity,
    setProjectionOpen,
  } = useReport()

  return (
    <div className="report-page">
      <div className="report-container">
        <header className="report-header">
          <h1 className="report-header__title">Cursor 用量报告</h1>
          <div className="report-header__meta">
            <span>{fileName ?? '未选择文件'}</span>
            <span>·</span>
            <span>
              {meta?.dateFrom && meta?.dateTo
                ? `${meta.dateFrom} ~ ${meta.dateTo}`
                : '日期范围 —'}
            </span>
            <span>·</span>
            <span>{rowCount.toLocaleString()} 行</span>
            <ParseStatusBadge unknownModels={meta?.unknownModels} skippedRows={meta?.skippedRows} />
          </div>
          <ExportPngButton />
          <button type="button" className="report-header__action" onClick={clear}>
            更换文件
          </button>
        </header>

        <FilterBar filters={filters} allModels={allModels} onChange={setFilters} />

        <div className="report-grid report-grid--triple">
          <KpiCards
            billing={agg.billing}
            totalTokens={agg.totalTokens}
            days={agg.days}
            peakDate={agg.peak?.date ?? null}
            peakValue={agg.peak?.value ?? 0}
            topModel={agg.peak?.topModel ?? null}
          />
          <ChartPanel title="#4 计费口径环图">
            <BillingDonut totals={agg.billing} mode={filters.billingMode} />
          </ChartPanel>
          <ChartPanel title="#6 池环图">
            <PoolDonut byPool={agg.byPool} limits={poolLimits} />
          </ChartPanel>
        </div>

        <div className="report-grid report-grid--double">
          <ChartPanel title="#5 模型消费" tall>
            <ModelChart
              byModel={agg.byModel}
              view={modelView}
              onViewChange={setModelView}
            />
          </ChartPanel>
          <ChartPanel title="#8 用量结构" tall>
            <TokenStructureChart
              data={agg.structure}
              view={structureView}
              onViewChange={setStructureView}
            />
          </ChartPanel>
        </div>

        <div className="report-grid report-grid--daily-side">
          <ChartPanel title="#7 日消费" tall>
            <DailyChart daily={agg.daily} cumulative={agg.dailyCumulative} />
          </ChartPanel>
          <div className="report-stack">
            <ChartPanel title="#9 缓存命中率">
              <CacheHitChart rates={agg.cacheHit} />
            </ChartPanel>
            <ChartPanel title="#10 单 Token 价">
              <UnitPriceChart prices={agg.unitPrice} />
            </ChartPanel>
          </div>
        </div>

        <div className="report-grid report-grid--activity">
          <ChartPanel title="#11 日活跃时段">
            <HourlyChart
              hourly={agg.hourly}
              view={hourlyView}
              granularity={dailyActivityGranularity}
              onViewChange={setHourlyView}
              onGranularityChange={setDailyActivityGranularity}
            />
          </ChartPanel>
          <ChartPanel title="#12 周活跃时段">
            <WeeklyHeatmap
              matrix={agg.weekly}
              granularity={weeklyActivityGranularity}
              onGranularityChange={setWeeklyActivityGranularity}
            />
          </ChartPanel>
          <ChartPanel title="#13 年热力图">
            {heatmapVisible ? (
              <YearHeatmap data={agg.heatmap} />
            ) : (
              <p className="chart-empty">数据跨度 &lt; 90 天，已隐藏年热力图</p>
            )}
          </ChartPanel>
        </div>

        <PoolProjection
          projection={agg.projection}
          limits={poolLimits}
          byPool={agg.byPool}
          open={projectionOpen}
          onToggle={setProjectionOpen}
          onLimitsChange={setPoolLimits}
        />
      </div>
    </div>
  )
}
