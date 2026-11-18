import type { EngineInterface, Register } from 'claude-code'


const FENCE = /```mermaid[^\S\r\n]*\r?\n([\s\S]*?)\r?\n?```/g

const findDiagrams = (text: string): string[] =>
  [...text.matchAll(FENCE)].map(m => (m[1] ?? '').trim()).filter(s => s.length > 0)

const escapeHtml = (s: string) =>
  s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')

const toHtml = (diagrams: readonly string[]) => `<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Mermaid 預覽</title>
<style>
  :root { color-scheme: light dark; --bg: #ffffff; --fg: #1f2328; --card: #f6f8fa; --line: #d0d7de; }
  @media (prefers-color-scheme: dark) { :root { --bg: #0d1117; --fg: #e6edf3; --card: #161b22; --line: #30363d; } }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 24px 0; background: var(--bg); color: var(--fg);
         font-family: system-ui, "Microsoft JhengHei", sans-serif; }
  main { width: 98%; margin: 0 auto; display: grid; gap: 24px; }
  section { background: var(--card); border: 1px solid var(--line); border-radius: 8px; padding: 16px; min-width: 0; }
  header { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
  h2 { font-size: 14px; margin: 0; opacity: .7; font-weight: 600; }
  .tools { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
  .tools button { font: inherit; font-size: 13px; min-width: 32px; height: 30px; padding: 0 10px; cursor: pointer;
                  color: var(--fg); background: var(--bg); border: 1px solid var(--line); border-radius: 6px; }
  .tools button:hover { border-color: #0969da; color: #0969da; }
  .tools .pct { min-width: 52px; text-align: center; font-size: 13px; font-variant-numeric: tabular-nums; opacity: .8; }
  .viewport { overflow: auto; max-height: 80vh; border: 1px dashed var(--line); border-radius: 6px;
              background: var(--bg); cursor: grab; }
  .viewport.dragging { cursor: grabbing; user-select: none; }
  .stage { display: flex; justify-content: center; align-items: flex-start; padding: 16px; min-width: max-content; }
  .viewport.wide .stage { justify-content: flex-start; }
  .mermaid { margin: 0; }
  .mermaid svg { display: block; }
  .hint { font-size: 12px; opacity: .55; margin-top: 6px; }
  details { margin-top: 12px; font-size: 13px; }
  details pre { white-space: pre-wrap; opacity: .8; }
</style>
</head>
<body>
<main>
${diagrams
  .map(
    (src, i) => `<section>
  <header>
    <h2>圖 ${i + 1}</h2>
    <div class="tools">
      <button type="button" data-act="out" title="縮小">−</button>
      <span class="pct">100%</span>
      <button type="button" data-act="in" title="放大">+</button>
      <button type="button" data-act="fit" title="縮放到容器寬度">適合寬度</button>
      <button type="button" data-act="reset" title="原始大小">100%</button>
    </div>
  </header>
  <div class="viewport"><div class="stage"><pre class="mermaid">${escapeHtml(src)}</pre></div></div>
  <div class="hint">Ctrl + 滾輪縮放，拖曳可平移</div>
  <details><summary>原始碼</summary><pre>${escapeHtml(src)}</pre></details>
</section>`,
  )
  .join('\n')}
</main>
<script src="https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.min.js"></script>
<script>
  var dark = matchMedia('(prefers-color-scheme: dark)').matches;
  mermaid.initialize({ startOnLoad: false, theme: dark ? 'dark' : 'default', securityLevel: 'strict' });

  var MIN = 0.1, MAX = 8, STEP = 1.2;

  function setup(section) {
    var svg = section.querySelector('.mermaid svg');
    if (!svg) return;
    var viewport = section.querySelector('.viewport');
    var pct = section.querySelector('.pct');
    var vb = svg.viewBox && svg.viewBox.baseVal;
    var box = svg.getBoundingClientRect();
    var w = vb && vb.width ? vb.width : box.width;
    var h = vb && vb.height ? vb.height : box.height;
    var scale = 1;

    svg.style.maxWidth = 'none';
    svg.removeAttribute('width');
    svg.removeAttribute('height');

    function fitScale() {
      return Math.max(MIN, Math.min(MAX, (viewport.clientWidth - 32) / w));
    }

    function apply(next, anchorX, anchorY) {
      next = Math.max(MIN, Math.min(MAX, next));
      var ax = anchorX == null ? viewport.clientWidth / 2 : anchorX;
      var ay = anchorY == null ? viewport.clientHeight / 2 : anchorY;
      var cx = (viewport.scrollLeft + ax) / scale;
      var cy = (viewport.scrollTop + ay) / scale;
      scale = next;
      svg.style.width = (w * scale) + 'px';
      svg.style.height = (h * scale) + 'px';
      viewport.classList.toggle('wide', w * scale + 32 > viewport.clientWidth);
      viewport.scrollLeft = cx * scale - ax;
      viewport.scrollTop = cy * scale - ay;
      pct.textContent = Math.round(scale * 100) + '%';
    }

    section.querySelector('.tools').addEventListener('click', function (ev) {
      var act = ev.target && ev.target.getAttribute('data-act');
      if (act === 'in') apply(scale * STEP);
      else if (act === 'out') apply(scale / STEP);
      else if (act === 'fit') apply(fitScale());
      else if (act === 'reset') apply(1);
    });

    viewport.addEventListener('wheel', function (ev) {
      if (!ev.ctrlKey && !ev.metaKey) return;
      ev.preventDefault();
      var r = viewport.getBoundingClientRect();
      apply(scale * (ev.deltaY < 0 ? STEP : 1 / STEP), ev.clientX - r.left, ev.clientY - r.top);
    }, { passive: false });

    var drag = null;
    viewport.addEventListener('pointerdown', function (ev) {
      if (ev.button !== 0) return;
      drag = { x: ev.clientX, y: ev.clientY, l: viewport.scrollLeft, t: viewport.scrollTop };
      viewport.classList.add('dragging');
      viewport.setPointerCapture(ev.pointerId);
    });
    viewport.addEventListener('pointermove', function (ev) {
      if (!drag) return;
      viewport.scrollLeft = drag.l - (ev.clientX - drag.x);
      viewport.scrollTop = drag.t - (ev.clientY - drag.y);
    });
    function endDrag() { drag = null; viewport.classList.remove('dragging'); }
    viewport.addEventListener('pointerup', endDrag);
    viewport.addEventListener('pointercancel', endDrag);

    // Start wide: fill the container, but never blow a small chart past 2x.
    apply(Math.min(fitScale(), 2));
  }

  mermaid.run({ querySelector: '.mermaid' }).catch(function () {}).then(function () {
    document.querySelectorAll('section').forEach(setup);
  });
</script>
</body>
</html>
`

async function openInBrowser($: EngineInterface, diagrams: readonly string[]): Promise<boolean> {
  const temp = (await $.env.get('TEMP')) ?? (await $.env.get('TMPDIR')) ?? '/tmp'
  const os = await $.env.get('OS')
  const isWindows = os === 'Windows_NT'
  const sep = isWindows ? '\\' : '/'
  const file = `${temp}${sep}claude-mermaid${sep}mermaid-${Date.now()}.html`

  try {
    await $.fs.write(file, toHtml(diagrams))

    const argv = isWindows
      ? ['cmd', '/c', 'start', '', file]
      : (await $.env.get('XDG_SESSION_TYPE')) !== undefined
        ? ['xdg-open', file]
        : ['open', file]

    await $.process.run(argv, { timeoutMs: 15000 })
    $.ui.toast(`已在瀏覽器開啟 ${diagrams.length} 張圖`)

    return true
  } catch {
    $.ui.toast(`無法自動開啟，檔案在 ${file}`)

    return false
  }
}

// Per set of diagrams (one message's): what its control shows right now.
type Phase = 'busy' | 'done' | 'failed'
const phases = new Map<string, Phase>()

async function pressOpen($: EngineInterface, id: string, diagrams: readonly string[]) {
  if (phases.get(id) === 'busy') {
    return
  }
  phases.set(id, 'busy')
  $.ui.invalidate('ui.render')

  const isOpened = await openInBrowser($, diagrams)
  phases.set(id, isOpened ? 'done' : 'failed')
  $.ui.invalidate('ui.render')

  await $.clock.sleep(2000)
  phases.delete(id)
  $.ui.invalidate('ui.render')
}

export const register: Register = on => {
  // Every diagram drawn in this session, oldest first, for /mermaid.
  const seen: string[] = []

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'mermaid',
      description: '把這次對話出現過的 mermaid 圖全部放進一個 HTML 用瀏覽器開啟',
    })
    const started = await next(e)
    // Redraw messages already on screen (history of a resumed session, or
    // replies drawn before this mod loaded) so they get the button too.
    $.ui.invalidate('ui.render')

    return started
  })

  on('command.run', { command: 'mermaid' }, async $ => {
    if (seen.length === 0) {
      return { text: '這次對話還沒有出現 mermaid 圖。' }
    }
    const isOpened = await openInBrowser($, seen)

    return { text: isOpened ? `已開啟 ${seen.length} 張 mermaid 圖。` : '開啟失敗。' }
  })

  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    if (e.props.isSummary) {
      return next(e)
    }
    const diagrams = findDiagrams(e.props.text)

    if (diagrams.length === 0) {
      return next(e)
    }
    for (const d of diagrams) {
      if (!seen.includes(d)) seen.push(d)
    }

    const { Box, Button, Text } = $.ui.resolve(e)
    const row = await next(e)
    const id = diagrams.join('\n\u0000\n')
    const phase = phases.get(id)
    const label =
      diagrams.length === 1 ? '📊 在瀏覽器開啟圖表' : `📊 在瀏覽器開啟 ${diagrams.length} 張圖表`

    const control =
      phase === 'busy' ? (
        <Text color="yellow">⏳ 正在產生 HTML 並開啟瀏覽器…</Text>
      ) : phase === 'done' ? (
        <Text color="green">✓ 已在瀏覽器開啟</Text>
      ) : phase === 'failed' ? (
        <Text color="red">✗ 開啟失敗，請看通知訊息</Text>
      ) : (
        <Button
          key="open-mermaid"
          label={label}
          variant="primary"
          onPress={() => void pressOpen($, id, diagrams)}
        />
      )

    return (
      <Box flexDirection="column">
        {row}
        {control}
      </Box>
    )
  })
}
