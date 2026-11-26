import { useId } from 'react';
import type { ReactNode, Dispatch } from 'react';
import type { SpatialAction } from './spatial';
import { ChevronDown } from 'lucide-react';
import type { ScoreDimension } from './report';
import { formatScore } from './report';
const statusNames = {
  pass: '满足报告条件',
  warn: '需关注',
  fail: '未满足报告条件',
  pending: '待数据',
};
const citationNames = {
  mandatory: '强制来源（后端标注）',
  reference: '参考标准',
  project: '项目目标',
  unspecified: '来源类别待确认',
};
export function DimensionAccordion({
  dimension: d,
  open,
  onToggle,
  onSpatialAction,
  depthPreview,
  onInspectDepth,
}: {
  dimension: ScoreDimension;
  open: boolean;
  onToggle: () => void;
  onSpatialAction: Dispatch<SpatialAction>;
  depthPreview?: ReactNode;
  onInspectDepth?: (key: string) => void;
}) {
  const id = useId();
  return (
    <section className={`dimension-accordion ${open ? 'is-open' : ''}`}>
      <h3>
        <button type="button" aria-expanded={open} aria-controls={id} onClick={onToggle}>
          <span>{d.name}</span>
          <span className="contribution">
            {formatScore(d.score)} / {d.weight}
          </span>
          <ChevronDown size={15} />
        </button>
      </h3>
      <div className="accordion-reveal" id={id} inert={!open}>
        <div>
          {d.items.length ? (
            d.items.map((item) => (
              <div
                key={item.key}
                className={`score-item status-${item.status}`}
                tabIndex={item.link_target ? 0 : undefined}
                aria-label={
                  item.link_target
                    ? `${item.name}，聚焦联动${item.link_target === 'sofa' ? '沙发位置' : '冬季剖面标注'}，仅分析提示${item.link_target === 'winter-depth' && onInspectDepth ? '；Enter查看两至剖面' : ''}`
                    : undefined
                }
                onKeyDown={(event) => {
                  if (
                    event.target === event.currentTarget &&
                    item.link_target === 'winter-depth' &&
                    onInspectDepth &&
                    (event.key === 'Enter' || event.key === ' ')
                  ) {
                    event.preventDefault();
                    onInspectDepth(item.key);
                  }
                }}
                onMouseEnter={() => {
                  if (item.link_target)
                    onSpatialAction({ type: 'hover', key: item.key, target: item.link_target });
                }}
                onMouseLeave={() => onSpatialAction({ type: 'leave', key: item.key })}
                onFocus={() => {
                  if (item.link_target)
                    onSpatialAction({ type: 'focus', key: item.key, target: item.link_target });
                }}
                onBlur={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node | null))
                    onSpatialAction({ type: 'blur', key: item.key });
                }}
              >
                <div className="score-item-title">
                  <strong>
                    <i aria-label={statusNames[item.status]} />
                    {item.name}
                  </strong>
                  <span>
                    +{formatScore(item.score)} / {item.max_score}
                  </span>
                </div>
                <dl>
                  <dt>报告值</dt>
                  <dd>{item.value_display}</dd>
                  <dt>目标/阈值</dt>
                  <dd>{item.threshold_display}</dd>
                </dl>
                <p className="score-item-source">
                  <span>{citationNames[item.citation_kind]}</span>
                  {item.citation || '未提供来源'}
                </p>
                <p className="score-item-state">
                  {statusNames[item.status]}
                  {item.link_target && <span>悬停 / 聚焦：空间定位</span>}
                </p>
                {item.link_target === 'winter-depth' && onInspectDepth && (
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => onInspectDepth(item.key)}
                    aria-label={`查看${item.name}对应的两至剖面并保持定位`}
                  >
                    查看两至剖面 →
                  </button>
                )}
                {item.link_target === 'winter-depth' && depthPreview && (
                  <div className="mobile-depth-preview">{depthPreview}</div>
                )}
              </div>
            ))
          ) : (
            <p className="score-help">此维度尚未返回子项。</p>
          )}
        </div>
      </div>
    </section>
  );
}
