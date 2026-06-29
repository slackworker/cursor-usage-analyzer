import { ReportFileZone } from '../components/ReportFileZone'
import { BillingDonut } from '../components/charts/BillingDonut'
import { CacheHitChart } from '../components/charts/CacheHitChart'
import { ChartPanel } from '../components/charts/ChartPanel'
import { DailyChart } from '../components/charts/DailyChart'
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
    plan,
    modelView,
    structureView,
    dailyView,
    dailyChartLayout,
    hourlyView,
    dailyActivityGranularity,
    weeklyActivityGranularity,
    heatmapVisible,
    agg,
    setCsvFile,
    setFilters,
    setPoolLimits,
    setPlan,
    setModelView,
    setStructureView,
    setDailyView,
    setDailyChartLayout,
    setHourlyView,
    setDailyActivityGranularity,
    setWeeklyActivityGranularity,
  } = useReport()

  return (
    <div className="report-page">
      <div className="report-container">
        <ReportFileZone
          fileName={fileName}
          meta={meta}
          rowCount={rowCount}
          filters={filters}
          onFiltersChange={setFilters}
          onFileSelect={setCsvFile}
        />

        <div className="report-grid report-grid--triple">
          <KpiCards
            billing={agg.billing}
            totalTokens={agg.totalTokens}
            days={agg.days}
            peakDate={agg.peak?.date ?? null}
            peakValue={agg.peak?.value ?? 0}
          />
          <ChartPanel title="费用构成">
            <BillingDonut totals={agg.billing} mode={filters.billingMode} />
          </ChartPanel>
          <ChartPanel title="按池分布">
            <PoolDonut byPool={agg.byPool} />
          </ChartPanel>
        </div>

        <ChartPanel title="模型分布" tall>
          <ModelChart
            byModel={agg.byModel}
            view={modelView}
            onViewChange={setModelView}
          />
        </ChartPanel>

        <ChartPanel title="每日趋势" tall>
          <DailyChart
            daily={agg.daily}
            cumulative={agg.dailyCumulative}
            view={dailyView}
            layout={dailyChartLayout}
            onViewChange={setDailyView}
            onLayoutChange={setDailyChartLayout}
          />
        </ChartPanel>

        <div className="report-grid report-grid--double">
          <ChartPanel title="日内时段分布">
            <HourlyChart
              hourly={agg.hourly}
              view={hourlyView}
              granularity={dailyActivityGranularity}
              onViewChange={setHourlyView}
              onGranularityChange={setDailyActivityGranularity}
            />
          </ChartPanel>
          <ChartPanel title="周内时段分布">
            <WeeklyHeatmap
              matrix={agg.weekly}
              granularity={weeklyActivityGranularity}
              onGranularityChange={setWeeklyActivityGranularity}
            />
          </ChartPanel>
        </div>

        {heatmapVisible && (
          <ChartPanel title="年度活跃日历" tall>
            <YearHeatmap data={agg.heatmap} />
          </ChartPanel>
        )}

        <div className="report-grid report-grid--quad">
          <ChartPanel title="缓存命中率">
            <CacheHitChart rates={agg.cacheHit} modelTokens={agg.modelTokens} />
          </ChartPanel>
          <ChartPanel title="Token 单价">
            <UnitPriceChart prices={agg.unitPrice} modelTokens={agg.modelTokens} />
          </ChartPanel>
          <ChartPanel title="Token 构成">
            <TokenStructureChart
              data={agg.structure}
              view={structureView}
              onViewChange={setStructureView}
            />
          </ChartPanel>
          <ChartPanel title="池使用率">
            <PoolProjection
              projection={agg.projection}
              plan={plan}
              limits={poolLimits}
              onPlanChange={setPlan}
              onLimitsChange={setPoolLimits}
            />
          </ChartPanel>
        </div>
      </div>
    </div>
  )
}
