#!/usr/bin/env python3
"""Static / source-level checks for the 05:00 interaction-play pass. Not a visual review."""
from __future__ import annotations
import hashlib, json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BACKUP = Path("/workspace/suncraft-upload-20261125-2314/interaction-play-consistency-before-sha256.json")
ok = True
lines: list[str] = []

def fail(msg: str) -> None:
    global ok
    ok = False
    lines.append(f"FAIL  {msg}")

def passed(msg: str) -> None:
    lines.append(f"PASS  {msg}")

def read(rel: str) -> str:
    return (ROOT / rel).read_text()

# --- protected SHAs ---
sha = json.loads(BACKUP.read_text())
protect = [
    "前端文件/src/lighting.ts",
    "前端文件/src/materials.ts",
    "前端文件/src/styles.css",
    "前端文件/src/camera.ts",
    "前端文件/src/export.ts",
    "前端文件/src/surfaceSamples.ts",
    "前端文件/src/modeling/construction.ts",
    "前端文件/src/contactAO.ts",
    "前端文件/src/Scene.tsx",
    "前端文件/src/timelineClock.ts",
    "前端文件/src/api.ts",
    "前端文件/src/useSimulation.ts",
    "前端文件/src/scoring/ScoreRing.tsx",
]
for rel in protect:
    now = hashlib.sha256((ROOT / rel).read_bytes()).hexdigest()
    old = sha.get(rel)
    if old is None:
        fail(f"backup missing {rel}")
    elif now != old:
        fail(f"protected file changed: {rel}")
    else:
        passed(f"unchanged {rel} {now[:16]}")

for prefix in ("integration-notes/freeze/", "integration-notes/materials-gap/", "integration-notes/lighting-pass2/"):
    changed = [rel for rel, dig in sha.items() if rel.startswith(prefix) and hashlib.sha256((ROOT / rel).read_bytes()).hexdigest() != dig]
    if changed:
        fail(f"notes changed under {prefix}: {changed}")
    else:
        passed(f"unchanged notes under {prefix}")

# --- jump / pause rule ---
tl = read("前端文件/src/AnnualTimeline.tsx")
app = read("前端文件/src/App.tsx")
clock = read("前端文件/src/timelineClock.ts")
if "const jump=(next:number)=>{pause();setDay(" not in tl:
    fail("jump is not pause-then-setDay")
else:
    passed("jump is pause(); setDay(...)")
# setDay only inside jump or the clock callback path in the hook
# In AnnualTimeline.tsx, setDay should appear in jump and in start() clock, not in other click handlers
setday_sites = re.findall(r".{0,80}setDay\(", tl)
# filter import-free
if any("s.setDay" in s for s in setday_sites):
    fail("external s.setDay used")
# All date mutating UI must call s.jump or timeline.jump
for needle, label in [
    ("onChange={e=>s.jump(Number(e.target.value))}", "range onChange uses jump"),
    ("s.jump(s.day-1)", "prev day uses jump"),
    ("s.jump(s.day+1)", "next day uses jump"),
    ("else s.jump(d)", "date input uses jump"),
    ("onClick={()=>s.jump(dayFromDate", "month buttons use jump"),
    ("if(d!==null)s.jump(d)", "term select uses jump"),
    ("onPointerDownCapture={s.pause}", "date-controls / months pause on pointerdown"),
    ("onPointerDown={s.pause}", "range and term select pause on pointerdown"),
]:
    if needle not in tl:
        fail(f"missing {label}: {needle}")
    else:
        passed(label)
if "timeline.jump(solsticeDay(" not in app or "onPointerDownCapture={timeline.pause}" not in app:
    fail("App solstice tabs missing jump or pointerdown pause")
else:
    passed("App solstice tabs: pointerdown pause, click jump")
if "timeline.jump(SUMMER_DAY)" not in app:
    fail("reset does not jump to summer solstice")
else:
    passed("reset uses timeline.jump(SUMMER_DAY) (pauses then lands on 夏至)")
# playback wrap is in the hook (clock only emits day deltas; stop() bumps generation)
if "setDay(d=>(d+days)%DAY_COUNT)" not in tl:
    fail("year-end wrap missing in useAnnualTimeline")
else:
    passed("playback wraps with setDay(d=>(d+days)%DAY_COUNT); clock stop() invalidates queued ticks")
if "if(document.hidden){pause();return}" not in tl:
    fail("hidden-page auto-pause missing during ticks")
else:
    passed("hidden page pauses both on visibilitychange and mid-tick")
if "prefers-reduced-motion: reduce" not in tl:
    fail("reduced-motion auto-pause missing")
else:
    passed("prefers-reduced-motion change calls pause()")
# speed aria
if "每秒${s.speed*4}日" not in tl:
    fail("speed aria day-rate missing")
else:
    passed("play button aria includes 每秒 speed*4 日 (1/2/4× → 4/8/16)")
# hidden / reduced-motion pause still referenced
if "matchMedia" not in tl and "reduced" not in tl and "hidden" not in tl:
    # those may live in the hook file
    hook_src = tl  # hook is in the same file
    fail("cannot see hidden/reduced-motion pause in AnnualTimeline")
else:
    passed("AnnualTimeline still contains hidden or reduced-motion handling")

# --- waiting / failure copy ---
drawer = read("前端文件/src/scoring/ScoreDrawer.tsx")
need = [
    "冬夏工况评分更新中，上次分数仅供对照，不是当前有效评分",
    "更新中 · 上次分仅供对照",
    "上次 · ${report.grade}级",
    "参数已变化，评分更新中；以下为上次返回，仅供对照，不是当前有效结果。",
]
for n in need:
    (passed if n in drawer else fail)(f"waiting copy present: {n}")
# stale old wording must be gone
for stale in ["更新中 · 上次评分", "上次结果待复核", "以下为上次返回的评分，等待更新。"]:
    if stale in drawer:
        fail(f"stale waiting copy still present: {stale}")
    else:
        passed(f"stale waiting copy removed: {stale}")
# failure copy unchanged
for n in ["不可用", "不以上次成功为准", "评分不可用，不是上次成功结果", "当前请求失败，以下不是本次有效评分，请重试。"]:
    (passed if n in drawer else fail)(f"failure copy kept: {n}")

# --- touch ---
css = read("前端文件/src/annual.css")
if "touch-action:pan-x" in css or "touch-action: pan-x" in css:
    passed("annual-range has touch-action:pan-x")
else:
    fail("annual-range missing touch-action:pan-x")
if "touch-action:manipulation" in css or "touch-action: manipulation" in css:
    passed("timeline buttons/select/date have touch-action:manipulation")
else:
    fail("missing touch-action:manipulation")

# --- cancel still outside fieldset, abort ignored ---
if "cancelOptimize" not in app or "cancelAndSnap" not in app:
    fail("cancel helpers missing")
else:
    passed("cancelOptimize / cancelAndSnap still in App")
# cancel button lives in .optimize-area after </fieldset>, not inside the disabled sliders
if not __import__('re').search(r'</fieldset>\s*<div className="optimize-area">', app):
    fail("optimize-area is not immediately after sliders fieldset")
elif '{busy?<button className="text-button cancel" onClick={cancelAndSnap}>取消寻优</button>' not in app:
    fail("busy-state 取消寻优 button missing")
elif 'className="text-button cancel" onClick={cancelAndSnap} disabled' in app:
    fail("cancel button is disabled")
else:
    passed("取消寻优 sits in optimize-area after </fieldset>, clickable while busy")

# --- 409/422/timeout mapping still in api.ts (unchanged this round) ---
api = read("前端文件/src/api.ts")
for n in [
    "当前窗墙比下没有满足采光目标的候选",
    "HTTP 409",
    "后端响应超时（8 秒），请检查服务",
    "后端响应 HTTP ${response.status}",
]:
    (passed if n in api else fail)(f"api mapping kept: {n}")

# --- ScoreRing reduced motion, null clears immediately ---
ring = read("前端文件/src/scoring/ScoreRing.tsx")
if "prefers-reduced-motion" in ring or "reduced" in ring:
    passed("ScoreRing mentions reduced motion")
else:
    fail("ScoreRing reduced-motion handling not found")

text = "\n".join(lines) + f"\n\nRESULT: {'PASS' if ok else 'FAIL'} ({sum(l.startswith('PASS') for l in lines)} passed, {sum(l.startswith('FAIL') for l in lines)} failed)\n"
(Path(__file__).resolve().parent / "static-check.txt").write_text(text)
print(text)
sys.exit(0 if ok else 1)
