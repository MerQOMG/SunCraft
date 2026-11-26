import { useEffect, useReducer, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ChevronDown, TriangleAlert, X } from 'lucide-react';
import type { ScoreReport, LinkTarget } from './report';
import { formatScore, gradeColor } from './report';
import { ScoreRing } from './ScoreRing';
import { DimensionAccordion } from './DimensionAccordion';
import { EMPTY_SPATIAL, spatialReducer, spatialTarget } from './spatial';
import type { SpatialAction } from './spatial';
import { EMPTY_INSPECTION, inspectionReducer, inspectionTarget } from './inspection';
export function ScoreCapsule({
  report,
  open,
  pending,
  error,
  onToggle,
  buttonRef,
  suppressed = false,
}: {
  report: ScoreReport | null;
  open: boolean;
  pending: boolean;
  error?: string;
  onToggle: () => void;
  buttonRef: React.RefObject<HTMLButtonElement | null>;
  suppressed?: boolean;
}) {
  const unavailable = !!error,
    example = !unavailable && report?.provenance === 'example',
    value = unavailable ? null : (report?.total_score ?? null),
    grade = unavailable ? '' : (report?.grade ?? '');
  const label = unavailable
    ? `评分不可用，不是上次成功结果，${open ? '收起' : '展开'}细则`
    : `${example ? '独立示例，非当前方案评分' : pending ? '冬夏工况评分更新中，上次分数仅供对照，不是当前有效评分' : '当前方案实时评分，冬夏设计工况，非当前日期或全年分'} ${formatScore(value)}，${report?.grade_label ?? '待后端评分数据'}，${open ? '收起' : '展开'}细则`;
  return (
    <button
      ref={buttonRef}
      className="score-capsule"
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-controls="score-drawer"
      aria-hidden={suppressed || undefined}
      tabIndex={suppressed ? -1 : undefined}
      inert={suppressed}
      aria-label={label}
    >
      <div className="capsule-score">
        <ScoreRing value={value} max={report?.max_score ?? 100} grade={grade} />
      </div>
      <span className="capsule-copy">
        <strong
          style={{ borderColor: unavailable || !report ? undefined : gradeColor(report.grade) }}
        >
          {unavailable
            ? '不可用'
            : example
              ? `示例 · ${report?.grade}级`
              : pending && report?.grade
                ? `上次 · ${report.grade}级`
                : report?.grade
                  ? `${report.grade}级`
                  : '待接入'}
        </strong>
        <small>
          {unavailable
            ? '不以上次成功为准'
            : example
              ? '非当前方案'
              : pending
                ? report
                  ? '更新中 · 上次分仅供对照'
                  : '评分请求中'
                : report
                  ? '方案实时分'
                  : '后端尚未提供评分'}
        </small>
      </span>
      <span className="capsule-detail">
        {!unavailable && (report?.warnings.length ?? 0) > 0 && (
          <TriangleAlert size={13} aria-hidden="true" />
        )}
        细则
        <ChevronDown size={13} />
      </span>
    </button>
  );
}
export type ReportView = 'score' | 'date' | 'cases';
const REPORT_VIEWS: [ReportView, string][] = [
  ['score', '评分细则'],
  ['date', '日期几何'],
  ['cases', '两至工况'],
];
export function ScoreDrawer({
  open,
  report,
  pending,
  error,
  simulationNotice,
  onClose,
  onHighlight,
  onOptimize,
  onCancel,
  busy,
  canOptimize,
  children,
  renderDepthPreview,
  preview,
  applicability,
  view,
  onViewChange,
  focusRequest = 0,
  scopeKey = '',
  failed = false,
}: {
  open: boolean;
  report: ScoreReport | null;
  pending: boolean;
  error?: string;
  simulationNotice?: ReactNode;
  onClose: () => void;
  onHighlight: (target: LinkTarget | null) => void;
  onOptimize: () => void;
  onCancel: () => void;
  busy: boolean;
  canOptimize: boolean;
  children: ReactNode;
  preview?: ReactNode;
  applicability?: ReactNode;
  renderDepthPreview?: (drawingId: string) => ReactNode;
  view?: ReportView;
  onViewChange?: (view: ReportView) => void;
  focusRequest?: number;
  scopeKey?: string;
  failed?: boolean;
}) {
  const [openId, setOpenId] = useState<string | null>(null),
    [localView, setLocalView] = useState<ReportView>('score'),
    close = useRef<HTMLButtonElement>(null),
    body = useRef<HTMLDivElement>(null),
    lastFocusRequest = useRef(0),
    tabs = useRef<Record<ReportView, HTMLButtonElement | null>>({
      score: null,
      date: null,
      cases: null,
    });
  const active = view ?? localView,
    changeView = onViewChange ?? setLocalView;
  useEffect(() => {
    if (!open) return;
    close.current?.focus();
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !document.querySelector('[aria-modal="true"]')) {
        event.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [open, onClose]);
  useEffect(() => {
    if (!open) return;
    if (body.current) body.current.scrollTop = 0;
    const heading = document.querySelector<HTMLElement>(`#report-panel-${active} h3`);
    heading?.scrollIntoView({ block: 'nearest', behavior: 'auto' });
  }, [active, open]);
  useEffect(() => {
    if (!open || focusRequest === 0 || lastFocusRequest.current === focusRequest) return;
    const id = requestAnimationFrame(() => {
      lastFocusRequest.current = focusRequest;
      const panel = document.getElementById(`report-panel-${active}`);
      panel?.focus({ preventScroll: true });
      panel?.scrollIntoView({ block: 'start', behavior: 'auto' });
    });
    return () => cancelAnimationFrame(id);
  }, [open, active, focusRequest]);
  const [spatial, dispatchSpatial] = useReducer(spatialReducer, EMPTY_SPATIAL),
    [inspection, dispatchInspection] = useReducer(inspectionReducer, EMPTY_INSPECTION);
  const target = inspectionTarget(open, active, spatialTarget(spatial), inspection);
  function handleSpatial(action: SpatialAction) {
    dispatchSpatial(action);
    if (action.type === 'focus')
      dispatchInspection({ type: 'focus', owner: { key: action.key, target: action.target } });
  }
  function navigateView(next: ReportView) {
    dispatchInspection({ type: 'navigate', view: next });
    changeView(next);
  }
  function inspectDepth(key: string) {
    dispatchInspection({ type: 'activate', owner: { key, target: 'winter-depth' } });
    changeView('cases');
    requestAnimationFrame(() => {
      const panel = document.getElementById('report-panel-cases');
      if (panel && !panel.hidden && !panel.closest('[inert]')) {
        panel.focus({ preventScroll: true });
        panel.scrollIntoView({ block: 'start', behavior: 'auto' });
      }
    });
  }
  useEffect(() => {
    dispatchInspection({ type: 'clear' });
  }, [open, openId, report, pending, scopeKey, failed]);
  useEffect(() => {
    if (active !== 'cases') dispatchInspection({ type: 'clear' });
  }, [active]);
  useEffect(() => {
    if (!open) return;
    const forget = (event: Event) => {
      const element = event.target;
      if (
        !(element instanceof Element) ||
        !element.closest('#score-drawer .score-item,#score-drawer [role="tab"]')
      )
        dispatchInspection({ type: 'forget-candidate' });
    };
    const blur = () => dispatchInspection({ type: 'forget-candidate' });
    document.addEventListener('focusin', forget);
    document.addEventListener('pointerdown', forget);
    window.addEventListener('blur', blur);
    return () => {
      document.removeEventListener('focusin', forget);
      document.removeEventListener('pointerdown', forget);
      window.removeEventListener('blur', blur);
    };
  }, [open]);
  useEffect(() => {
    dispatchSpatial({ type: 'clear' });
  }, [open, openId, report, active]);
  useEffect(() => {
    onHighlight(target);
  }, [open, active, target, onHighlight]);
  const previewDimension =
      active === 'score'
        ? report?.dimensions.find(
            (d) => d.id === openId && d.items.some((item) => item.link_target === 'winter-depth'),
          )
        : undefined,
    example = report?.provenance === 'example',
    local = report?.provenance === 'local';
  return (
    <section
      id="score-drawer"
      className={`score-drawer ${open ? 'is-open' : ''}`}
      role="region"
      aria-labelledby="score-drawer-title"
      aria-hidden={!open}
      inert={!open}
    >
      <header className="score-drawer-heading">
        <div className="report-heading-row">
          <div>
            <h2 id="score-drawer-title">光热分析</h2>
            <p>按来源分别查看 · 日期不重计分</p>
          </div>
          <button ref={close} className="icon-button" aria-label="关闭光热分析" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="report-tabs" role="tablist" aria-label="分析信息来源">
          {REPORT_VIEWS.map(([id, label], index) => (
            <button
              key={id}
              ref={(el) => {
                tabs.current[id] = el;
              }}
              id={`report-tab-${id}`}
              role="tab"
              aria-selected={active === id}
              aria-controls={`report-panel-${id}`}
              tabIndex={active === id ? 0 : -1}
              onClick={() => navigateView(id)}
              onKeyDown={(event) => {
                let next = index;
                if (event.key === 'ArrowRight') next = (index + 1) % REPORT_VIEWS.length;
                else if (event.key === 'ArrowLeft')
                  next = (index + REPORT_VIEWS.length - 1) % REPORT_VIEWS.length;
                else if (event.key === 'Home') next = 0;
                else if (event.key === 'End') next = REPORT_VIEWS.length - 1;
                else return;
                event.preventDefault();
                const target = REPORT_VIEWS[next][0];
                navigateView(target);
                tabs.current[target]?.focus();
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </header>
      <div ref={body} className="score-drawer-body">
        {applicability}
        {simulationNotice}
        {error && (
          <p role="alert" className="score-report-error">
            评分暂不可用：{error}。原模拟指标与剖面仍可使用。
          </p>
        )}
        <section
          id="report-panel-score"
          role="tabpanel"
          aria-labelledby="report-tab-score"
          className="report-view-panel"
          hidden={active !== 'score'}
          tabIndex={0}
        >
          <h3>
            {example
              ? '独立评分示例'
              : local
                ? '当前方案评分 · 本地实时计算'
                : '当前方案评分 · 后端计算'}
          </h3>
          {report ? (
            <>
              <p className="score-provenance">
                {example
                  ? '以下为固定界面示例，不随参数或寻优变化；模拟指标在“两至工况”单列，不参与此示例评分。'
                  : failed
                    ? '当前请求失败，以下不是本次有效评分，请重试。'
                    : pending
                      ? '参数已变化，评分更新中；以下为上次返回，仅供对照，不是当前有效结果。'
                      : local
                        ? '分数与十项贡献来自当前方案的本地模型计算，调整城市、挑檐、百叶或窗墙比会重新计算；与后端采用相同规则，不作规范认证。'
                        : '以下报告值与来源由接口提供，不作规范认证。'}
              </p>
              {report.completeness === 'partial' && (
                <p className="score-partial">
                  报告不完整：仅展示后端已返回的维度/子项，不补造其余结果。
                </p>
              )}
              <div className="dimension-overview" aria-label="各维度得分总览">
                {report.dimensions.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => setOpenId((id) => (id === d.id ? null : d.id))}
                    aria-label={`${d.name} ${formatScore(d.score)}/${d.weight}，展开子项`}
                  >
                    <span>
                      <span>{d.name}</span>
                      <b>
                        {formatScore(d.score)} / {d.weight}
                      </b>
                    </span>
                    <i>
                      <i
                        style={{
                          width: `${d.weight ? Math.min(100, ((d.score ?? 0) / d.weight) * 100) : 0}%`,
                          background: gradeColor(report.grade),
                        }}
                      />
                    </i>
                  </button>
                ))}
              </div>
              {report.warnings.length > 0 && (
                <details className="score-warnings">
                  <summary>
                    <TriangleAlert size={14} />
                    口径与警示（{report.warnings.length}）
                  </summary>
                  <ul>
                    {report.warnings.map((w) => (
                      <li key={w.id}>{w.message}</li>
                    ))}
                  </ul>
                  <p>警示单列，不擅自清零；来源分类不等于合规认定。</p>
                </details>
              )}
              <div className="score-dimensions">
                {report.dimensions.map((d) => (
                  <DimensionAccordion
                    key={d.id}
                    dimension={d}
                    open={openId === d.id}
                    onToggle={() => setOpenId((id) => (id === d.id ? null : d.id))}
                    onSpatialAction={handleSpatial}
                    onInspectDepth={inspectDepth}
                    depthPreview={
                      d.items.some((item) => item.link_target === 'winter-depth')
                        ? renderDepthPreview?.(`score-linked-mobile-${d.id}`)
                        : undefined
                    }
                  />
                ))}
              </div>
              <div className="score-method">
                <strong>
                  {example ? '示例口径' : local ? '本地计算方法' : '后端方法声明 · 前端未验证'}
                </strong>
                <p>{report.methodology_note || '后端尚未提供方法声明。'}</p>
                <p>精度、法规适用与S级可达性需独立验证。</p>
              </div>
            </>
          ) : (
            <p className="score-provenance">
              当前模拟接口未提供
              score_report。保留原有指标、热力与剖面，不从正午结果推造全天日照或低碳分数。
            </p>
          )}
        </section>
        <section
          id="report-panel-date"
          role="tabpanel"
          aria-labelledby="report-tab-date"
          className="report-view-panel"
          hidden={active !== 'date'}
          tabIndex={0}
        >
          <h3>当前日期 · 前端几何</h3>
          {preview}
        </section>
        <section
          id="report-panel-cases"
          role="tabpanel"
          aria-labelledby="report-tab-cases"
          className="report-view-panel"
          hidden={active !== 'cases'}
          tabIndex={0}
        >
          <h3>
            {example ? '演示两至工况' : local ? '本地两至工况' : '后端两至工况'}{' '}
            <span className="report-update">
              {failed
                ? '不可用'
                : pending
                  ? '更新中'
                  : example
                    ? '近似示例'
                    : local
                      ? '本地计算'
                      : '接口结果'}
            </span>
          </h3>
          <p className="report-scope">
            {example ? '演示' : local ? '本地计算' : '接口'}指标与代表射线，不是所选日期或全年性能。
          </p>
          {inspection.selected && (
            <p className="score-help inspection-selection" role="status">
              已定位：冬季阳光进深
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  dispatchInspection({ type: 'clear' });
                  document.getElementById('report-panel-cases')?.focus({ preventScroll: true });
                }}
              >
                清除定位
              </button>
            </p>
          )}
          {children}
        </section>
        <div className="score-optimize">
          <button className="optimize-button" onClick={onOptimize} disabled={!canOptimize || busy}>
            {busy ? '正在优化参数…' : example ? '优化构件' : '优化评分'}
          </button>
          {busy && (
            <button className="text-button" onClick={onCancel}>
              取消寻优
            </button>
          )}
          <p>
            {example
              ? '近似网格寻优，不对应此独立评分示例。'
              : '保持窗墙比与城市，使用同一总分规则，在采光目标内寻优；无可行方案时会提示。'}
          </p>
        </div>
      </div>
      {previewDimension && renderDepthPreview && (
        <div className="linked-section-preview">{renderDepthPreview('score-linked-desktop')}</div>
      )}
    </section>
  );
}
