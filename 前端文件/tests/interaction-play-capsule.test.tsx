import { createRef } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect } from 'vitest';
import { EXAMPLE_SCORE_REPORT as fixture } from './fixtures/scoreReport';
import { ScoreCapsule, ScoreDrawer } from '../src/scoring/ScoreDrawer';
const noop = () => {};
const live = {
  ...fixture,
  provenance: 'backend' as const,
  grade: 'S',
  grade_label: '优秀',
  total_score: 91.14974,
};
describe('waiting and failure capsule copy', () => {
  it('pending last score is labeled comparison-only, not the live result', () => {
    const pending = renderToStaticMarkup(
      <ScoreCapsule
        report={live}
        open={false}
        pending
        error={undefined}
        onToggle={noop}
        buttonRef={createRef()}
      />,
    );
    const failed = renderToStaticMarkup(
      <ScoreCapsule
        report={null}
        open={false}
        pending={false}
        error="网络已断开，显示为上次成功"
        onToggle={noop}
        buttonRef={createRef()}
      />,
    );
    const drawer = renderToStaticMarkup(
      <ScoreDrawer
        report={live}
        open
        pending={true}
        failed={false}
        onClose={noop}
        onHighlight={noop}
        onOptimize={noop}
        onCancel={noop}
        busy={false}
        canOptimize
      >
        {null}
      </ScoreDrawer>,
    );
    expect(pending).toContain('更新中 · 上次分仅供对照');
    expect(pending).toContain('上次 · ');
    expect(pending).toContain('不是当前有效评分');
    expect(pending).toContain('91.1'); // last score still visible as comparison
    expect(pending).not.toContain('不以上次成功为准');
    expect(failed).toContain('不可用');
    expect(failed).toContain('不以上次成功为准');
    expect(failed).not.toContain('88.4');
    expect(failed).not.toContain('上次分仅供对照');
    expect(drawer).toContain('评分更新中；以下为上次返回，仅供对照，不是当前有效结果。');
  });
});
