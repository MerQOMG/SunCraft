import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Play, Pause, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { DAY_COUNT, SUMMER_DAY, WINTER_DAY, SOLAR_TERMS, dayFromDate, termAt } from '../annual';
import type { SolarFrame } from '../annual';
import { createDateClock } from '../timelineClock';
export function useAnnualTimeline() {
  const [day, setDay] = useState(SUMMER_DAY),
    [playing, setPlaying] = useState(false),
    [speed, setSpeed] = useState(1),
    [message, setMessage] = useState('');
  const clock = useRef<ReturnType<typeof createDateClock> | null>(null),
    requested = useRef(false);
  const pause = () => {
    requested.current = false;
    clock.current?.stop();
    setPlaying(false);
  };
  const toggle = () => {
    if (requested.current) pause();
    else {
      requested.current = true;
      setPlaying(true);
    }
  };
  const jump = (next: number) => {
    pause();
    setDay(Math.max(0, Math.min(DAY_COUNT - 1, Math.round(next))));
    setMessage('');
  };
  useEffect(() => {
    const hidden = () => {
        if (document.hidden) pause();
      },
      media = matchMedia('(prefers-reduced-motion: reduce)'),
      reduce = () => pause();
    document.addEventListener('visibilitychange', hidden);
    media.addEventListener('change', reduce);
    return () => {
      document.removeEventListener('visibilitychange', hidden);
      media.removeEventListener('change', reduce);
    };
  }, []);
  useEffect(() => {
    if (!playing || !requested.current) return;
    const next = createDateClock(
      {
        request: (cb) => requestAnimationFrame(cb),
        cancel: (id) => cancelAnimationFrame(id),
        now: () => performance.now(),
      },
      (days) => {
        if (document.hidden) {
          pause();
          return;
        }
        setDay((d) => (d + days) % DAY_COUNT);
      },
    );
    clock.current = next;
    next.start(speed);
    return () => {
      next.stop();
      if (clock.current === next) clock.current = null;
    };
  }, [playing, speed]);
  return { day, playing, speed, message, jump, setSpeed, pause, toggle, setMessage };
}
export type AnnualTimelineState = ReturnType<typeof useAnnualTimeline>;
export default function AnnualTimeline({
  state: s,
  frame,
  onSection,
}: {
  state: AnnualTimelineState;
  frame: SolarFrame;
  onSection: () => void;
}) {
  const term = termAt(s.day),
    month = Number(frame.date.slice(5, 7)),
    [more, setMore] = useState(false),
    host = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const el = host.current,
      workspace = el?.closest<HTMLElement>('.workspace');
    if (!el || !workspace) return;
    const measure = () =>
      workspace.style.setProperty(
        '--annual-row-height',
        `${Math.ceil(el.getBoundingClientRect().height)}px`,
      );
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => {
      observer.disconnect();
      workspace.style.removeProperty('--annual-row-height');
    };
  }, []);
  return (
    <section ref={host} className="annual-timeline" aria-label="2026全年真太阳正午几何预览">
      <div className="annual-primary">
        <div className="annual-heading">
          <strong>2026 全年预览</strong>
          <span className="annual-term">{term.label}</span>
        </div>
        <div className="annual-playback">
          <button
            onClick={s.toggle}
            aria-label={`${s.playing ? '暂停' : '播放'}日期，${s.speed}倍，每秒${s.speed * 4}日`}
            aria-pressed={s.playing}
          >
            {s.playing ? <Pause size={16} /> : <Play size={16} />}
            <span>{s.playing ? '暂停' : '播放'}</span>
          </button>
          <select
            aria-label="日期播放倍速"
            value={s.speed}
            onChange={(e) => s.setSpeed(Number(e.target.value))}
          >
            <option value={1}>1×</option>
            <option value={2}>2×</option>
            <option value={4}>4×</option>
          </select>
        </div>
        <div className="annual-date-controls" onPointerDownCapture={s.pause}>
          <button disabled={s.day === 0} aria-label="前一天" onClick={() => s.jump(s.day - 1)}>
            <ChevronLeft size={16} />
          </button>
          <input
            aria-label="预览日期，仅2026年"
            type="date"
            min="2026-01-01"
            max="2026-12-31"
            value={frame.date}
            onChange={(e) => {
              const d = dayFromDate(e.target.value);
              if (d === null) s.setMessage('仅支持2026年有效日期');
              else s.jump(d);
            }}
          />
          <button
            disabled={s.day === DAY_COUNT - 1}
            aria-label="后一天"
            onClick={() => s.jump(s.day + 1)}
          >
            <ChevronRight size={16} />
          </button>
        </div>
        <span className="annual-altitude">
          高度 {frame.altitude.toFixed(1)}°{!frame.south ? ' · 北侧' : ''}
        </span>
        <button
          className="annual-section-trigger"
          onClick={() => {
            setMore(false);
            onSection();
          }}
        >
          日期剖面
        </button>
      </div>
      <div className="annual-axis">
        <input
          className="annual-range"
          type="range"
          aria-label="全年日期"
          min={0}
          max={DAY_COUNT - 1}
          step={1}
          value={s.day}
          aria-valuetext={`${frame.date}，${term.label}，真太阳正午`}
          onPointerDown={s.pause}
          onChange={(e) => s.jump(Number(e.target.value))}
        />
        <button
          aria-expanded={more}
          aria-controls="annual-more-tools"
          onClick={() => setMore((v) => !v)}
        >
          月份 / 节气
          <ChevronDown size={14} />
        </button>
      </div>
      <p className="annual-scope">真太阳12:00 · NOAA日级近似，非北京时间；DF/工况分固定</p>
      {more && (
        <div id="annual-more-tools" className="annual-extra">
          <div className="annual-months" aria-label="月份跳转" onPointerDownCapture={s.pause}>
            {Array.from({ length: 12 }, (_, i) => (
              <button
                key={i}
                aria-label={`跳转${i + 1}月1日`}
                aria-current={month === i + 1 ? 'date' : undefined}
                onClick={() => s.jump(dayFromDate(`2026-${String(i + 1).padStart(2, '0')}-01`)!)}
              >
                {i + 1}月
              </button>
            ))}
          </div>
          <label>
            2026节气 · 香港天文台日期
            <select
              aria-label="跳转节气，2026香港天文台日期"
              onPointerDown={s.pause}
              value={term.exact?.date ?? ''}
              onChange={(e) => {
                const d = dayFromDate(e.target.value);
                if (d !== null) s.jump(d);
              }}
            >
              <option value="">跳转节气</option>
              {SOLAR_TERMS.map((t) => (
                <option key={t.date} value={t.date}>
                  {t.name} {t.date.slice(5)}
                </option>
              ))}
            </select>
          </label>
          <p>
            1×每秒4日，年末循环；仅2026正午几何，非当天/全年性能。赤纬取当日UTC12代表值，无折射/天气，未校验实测精度。
            <a
              href="https://gml.noaa.gov/grad/solcalc/calcdetails.html"
              target="_blank"
              rel="noreferrer"
            >
              NOAA方法
            </a>{' '}
            ·{' '}
            <a
              href="https://www.hko.gov.hk/en/gts/time/calendar/pdf/files/2026e.pdf"
              target="_blank"
              rel="noreferrer"
            >
              HKO年历（UTC+8）
            </a>
          </p>
        </div>
      )}
      {s.message && (
        <p role="status" className="annual-input-error">
          {s.message}
        </p>
      )}
    </section>
  );
}
export const solsticeDay = (season: 'summer' | 'winter') =>
  season === 'summer' ? SUMMER_DAY : WINTER_DAY;
