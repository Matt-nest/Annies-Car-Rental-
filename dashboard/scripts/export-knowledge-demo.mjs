#!/usr/bin/env node
import { access, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { KNOWLEDGE_GUIDES } from '../src/data/knowledgeHub.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dashboardRoot = path.resolve(__dirname, '..');
const HIGGSFIELD_VOICE = {
  id: 'dc382508-c8bd-443c-8cb2-46e57b8d2e6f',
  name: 'Sterling',
  type: 'preset',
  variant: 'elevenlabs',
};

function argValue(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index === -1 || !process.argv[index + 1]) return fallback;
  return process.argv[index + 1];
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function timestamp(seconds) {
  const whole = Math.floor(seconds);
  const ms = Math.round((seconds - whole) * 1000);
  const h = String(Math.floor(whole / 3600)).padStart(2, '0');
  const m = String(Math.floor((whole % 3600) / 60)).padStart(2, '0');
  const s = String(whole % 60).padStart(2, '0');
  return `${h}:${m}:${s}.${String(ms).padStart(3, '0')}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

async function commandExists(command) {
  const paths = (process.env.PATH || '').split(path.delimiter);
  for (const dir of paths) {
    try {
      await access(path.join(dir, command));
      return true;
    } catch {
      /* keep looking */
    }
  }
  return false;
}

async function fileExists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

async function writeHiggsfieldVoiceover(outDir, narrationText) {
  const voiceoverPath = path.join(outDir, 'voiceover.mp3');
  if (await fileExists(voiceoverPath)) return voiceoverPath;
  if (!(await commandExists('higgsfield'))) {
    throw new Error('Higgsfield CLI not found. Run: npm install -g @higgsfield/cli && higgsfield auth login');
  }

  const result = spawnSync(
    'higgsfield',
    [
      'generate',
      'create',
      'text2speech_v2',
      '--prompt',
      narrationText,
      '--variant',
      HIGGSFIELD_VOICE.variant,
      '--voice-id',
      HIGGSFIELD_VOICE.id,
      '--voice-type',
      HIGGSFIELD_VOICE.type,
      '--wait',
      '--wait-timeout',
      '10m',
      '--json',
    ],
    { encoding: 'utf8' },
  );

  if (result.status !== 0) {
    throw new Error(result.stderr || 'Higgsfield voiceover generation failed.');
  }

  const jobs = JSON.parse(result.stdout);
  const url = jobs?.[0]?.result_url;
  if (!url) throw new Error('Higgsfield did not return a voiceover result_url.');

  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not download Higgsfield voiceover: ${response.status}`);
  const audio = Buffer.from(await response.arrayBuffer());
  await writeFile(voiceoverPath, audio);
  await writeFile(
    path.join(outDir, 'voiceover-meta.json'),
    JSON.stringify(
      {
        engine: 'higgsfield',
        model: 'text2speech_v2',
        variant: HIGGSFIELD_VOICE.variant,
        voiceName: HIGGSFIELD_VOICE.name,
        voiceId: HIGGSFIELD_VOICE.id,
        voiceType: HIGGSFIELD_VOICE.type,
        jobId: jobs?.[0]?.id,
        resultUrl: url,
      },
      null,
      2,
    ),
    'utf8',
  );
  return voiceoverPath;
}

async function writeSayVoiceover(outDir) {
  if (!(await commandExists('say'))) {
    throw new Error('macOS say command was not found.');
  }
  const voiceoverPath = path.join(outDir, 'voiceover.aiff');
  if (await fileExists(voiceoverPath)) return voiceoverPath;
  const result = spawnSync('say', ['-o', voiceoverPath, '-f', path.join(outDir, 'narration.txt')], {
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    throw new Error('macOS say failed while generating voiceover.aiff');
  }
  return voiceoverPath;
}

async function writeVoiceover(outDir, narrationText) {
  const engine = argValue('--voiceover-engine', 'higgsfield');
  if (engine === 'none') return null;
  if (engine === 'say') return writeSayVoiceover(outDir);
  if (engine !== 'higgsfield') throw new Error(`Unknown voiceover engine "${engine}". Use higgsfield, say, or none.`);
  return writeHiggsfieldVoiceover(outDir, narrationText);
}

function storyboardHtml(guide, stepSeconds) {
  const frames = guide.demo || [];
  const totalSeconds = frames.length * stepSeconds;
  const framesJson = JSON.stringify(frames);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(guide.title)} - Training Demo</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #111928;
      --panel: #1f2a37;
      --muted: #94a3b8;
      --text: #f8fafc;
      --accent: #13294b;
      --border: #313d4f;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      background: var(--bg);
      color: var(--text);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      display: grid;
      place-items: center;
    }
    .stage {
      width: min(1280px, 100vw);
      aspect-ratio: 16 / 9;
      position: relative;
      overflow: hidden;
      background: linear-gradient(135deg, #111928, #162032);
      border: 1px solid var(--border);
    }
    .meta {
      position: absolute;
      left: 44px;
      top: 34px;
      z-index: 10;
      width: 760px;
    }
    .eyebrow {
      font-size: 13px;
      line-height: 1;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--muted);
      font-weight: 800;
    }
    h1 {
      margin: 14px 0 8px;
      font-size: 34px;
      line-height: 1.04;
      letter-spacing: 0;
    }
    .subheading {
      margin: 0;
      font-size: 16px;
      line-height: 1.55;
      color: var(--muted);
    }
    .browser {
      position: absolute;
      inset: 136px 44px 112px;
      border-radius: 18px;
      border: 1px solid var(--border);
      overflow: hidden;
      background: #0f172a;
      box-shadow: 0 24px 80px rgba(0, 0, 0, 0.38);
    }
    .chrome {
      height: 38px;
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 0 18px;
      background: rgba(255, 255, 255, 0.04);
    }
    .dot { width: 10px; height: 10px; border-radius: 999px; }
    .screen-label {
      margin-left: 12px;
      color: var(--muted);
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }
    .canvas {
      position: absolute;
      inset: 38px 0 0;
      background: #f8fafc;
    }
    .canvas.dashboard { background: #111928; }
    .block {
      position: absolute;
      border-radius: 12px;
      border: 1px solid rgba(15, 23, 42, 0.15);
      display: grid;
      place-items: center;
      padding: 0 10px;
      text-align: center;
      font-size: 13px;
      font-weight: 800;
      color: #0f172a;
      background: white;
      box-shadow: 0 10px 28px rgba(15, 23, 42, 0.12);
      transition: transform 500ms cubic-bezier(0.16, 1, 0.3, 1), box-shadow 500ms ease;
    }
    .block.focus {
      transform: scale(1.08);
      z-index: 4;
      box-shadow: 0 22px 60px rgba(19, 41, 75, 0.38), 0 0 0 5px rgba(19, 41, 75, 0.18);
    }
    .block.nav { background: #13294b; color: white; }
    .block.action { background: #13294b; color: white; }
    .block.pill { background: #e1eaf3; color: #13294b; }
    .block.chart { background: #dcfce7; }
    .block.calendar { background: #fef3c7; }
    .cursor {
      position: absolute;
      width: 30px;
      height: 30px;
      z-index: 8;
      color: #13294b;
      filter: drop-shadow(0 12px 18px rgba(0, 0, 0, 0.35));
      transition: left 700ms cubic-bezier(0.16, 1, 0.3, 1), top 700ms cubic-bezier(0.16, 1, 0.3, 1);
    }
    .caption {
      position: absolute;
      left: 44px;
      right: 44px;
      bottom: 32px;
      min-height: 56px;
      border-radius: 14px;
      background: rgba(15, 23, 42, 0.84);
      border: 1px solid rgba(255, 255, 255, 0.12);
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 12px 28px;
      font-size: 20px;
      font-weight: 750;
      line-height: 1.35;
    }
    .progress {
      position: absolute;
      left: 44px;
      right: 44px;
      bottom: 102px;
      height: 5px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.12);
      overflow: hidden;
    }
    .bar {
      height: 100%;
      width: 0;
      border-radius: inherit;
      background: white;
      transition: width 400ms ease;
    }
    .frame-count {
      position: absolute;
      right: 44px;
      top: 44px;
      color: var(--muted);
      font-size: 13px;
      font-weight: 800;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }
  </style>
</head>
<body>
  <main class="stage">
    <div class="meta">
      <div class="eyebrow">Full training demo</div>
      <h1 id="heading">${escapeHtml(guide.title)}</h1>
      <p id="subheading" class="subheading">${escapeHtml(guide.summary)}</p>
    </div>
    <div class="frame-count" id="frame-count">1 / ${frames.length}</div>
    <section class="browser">
      <div class="chrome">
        <span class="dot" style="background:#f87171"></span>
        <span class="dot" style="background:#fbbf24"></span>
        <span class="dot" style="background:#34d399"></span>
        <span class="screen-label" id="screen-label">Customer site</span>
      </div>
      <div class="canvas" id="canvas"></div>
    </section>
    <svg class="cursor" id="cursor" viewBox="0 0 24 24" fill="white" stroke="currentColor" stroke-width="2.3" stroke-linejoin="round">
      <path d="M4 3l14 9-6 2.2L9.2 21 4 3z"></path>
    </svg>
    <div class="progress"><div class="bar" id="bar"></div></div>
    <div class="caption" id="caption"></div>
  </main>
  <script>
    const frames = ${framesJson};
    const stepMs = ${Math.round(stepSeconds * 1000)};
    const total = ${totalSeconds};
    let index = 0;
    const canvas = document.getElementById('canvas');
    const cursor = document.getElementById('cursor');
    const caption = document.getElementById('caption');
    const heading = document.getElementById('heading');
    const subheading = document.getElementById('subheading');
    const screenLabel = document.getElementById('screen-label');
    const frameCount = document.getElementById('frame-count');
    const bar = document.getElementById('bar');

    function render() {
      const frame = frames[index];
      canvas.className = 'canvas ' + (frame.screen === 'dashboard' ? 'dashboard' : 'customer');
      canvas.innerHTML = frame.blocks.map(block => '<div class="block ' + block.type + (block.id === frame.focusId ? ' focus' : '') + '"></div>').join('');
      [...canvas.children].forEach((node, i) => {
        const block = frame.blocks[i];
        node.setAttribute('style', ['left:' + block.x + '%', 'top:' + block.y + '%', 'width:' + block.w + '%', 'height:' + block.h + '%'].join(';'));
        node.textContent = block.label;
      });
      heading.textContent = frame.heading;
      subheading.textContent = frame.subheading;
      caption.textContent = frame.caption;
      screenLabel.textContent = frame.screen === 'dashboard' ? 'Admin dashboard' : 'Customer site';
      frameCount.textContent = (index + 1) + ' / ' + frames.length;
      cursor.style.left = frame.cursor.x + '%';
      cursor.style.top = frame.cursor.y + '%';
      bar.style.width = (((index + 1) / frames.length) * 100) + '%';
    }

    render();
    setInterval(() => {
      index = (index + 1) % frames.length;
      render();
    }, stepMs);

    window.__demo = { frames, stepMs, total };
  </script>
</body>
</html>`;
}

async function exportGuide(guide, outDir, stepSeconds) {
  const frames = guide.demo || [];
  if (!frames.length) {
    throw new Error(`Guide "${guide.id}" has no demo frames.`);
  }

  await mkdir(outDir, { recursive: true });

  const captions = ['WEBVTT', ''];
  const narration = [];
  const shotList = [
    `# ${guide.title}`,
    '',
    guide.summary,
    '',
    `Step length: ${stepSeconds}s`,
    `Frame count: ${frames.length}`,
    '',
    '## Shot List',
    '',
  ];

  frames.forEach((frame, index) => {
    const start = index * stepSeconds;
    const end = start + stepSeconds;
    captions.push(`${index + 1}`);
    captions.push(`${timestamp(start)} --> ${timestamp(end)}`);
    captions.push(frame.caption);
    captions.push('');
    narration.push(frame.narration || frame.caption);
    shotList.push(`${index + 1}. ${frame.heading}`);
    shotList.push(`   Screen: ${frame.screen === 'dashboard' ? 'Admin dashboard' : 'Customer site'}`);
    shotList.push(`   Caption: ${frame.caption}`);
    shotList.push(`   Voiceover: ${frame.narration || frame.caption}`);
    shotList.push('');
  });

  const files = {
    'captions.vtt': captions.join('\n'),
    'narration.txt': narration.join('\n\n'),
    'shot-list.md': shotList.join('\n'),
    'storyboard.html': storyboardHtml(guide, stepSeconds),
    'demo-manifest.json': JSON.stringify({ guideId: guide.id, title: guide.title, stepSeconds, frames }, null, 2),
  };

  await Promise.all(
    Object.entries(files).map(([name, content]) => writeFile(path.join(outDir, name), content, 'utf8')),
  );

  if (hasFlag('--voiceover')) {
    await writeVoiceover(outDir, narration.join('\n\n'));
  }

  console.log(`Knowledge demo assets exported to ${outDir}`);
}

async function main() {
  const all = hasFlag('--all');
  const guideId = argValue('--guide', 'customer-demo');
  const stepSeconds = Number(argValue('--seconds', '6'));
  const defaultOut = all ? 'demo-output' : path.join('demo-output', guideId);
  const baseOut = path.resolve(dashboardRoot, argValue('--out', defaultOut));
  const guides = all
    ? KNOWLEDGE_GUIDES.filter((item) => item.demo?.length)
    : [KNOWLEDGE_GUIDES.find((item) => item.id === guideId)];

  if (guides.some((guide) => !guide)) {
    throw new Error(`Unknown guide "${guideId}". Available: ${KNOWLEDGE_GUIDES.map((item) => item.id).join(', ')}`);
  }

  for (const guide of guides) {
    const outDir = all ? path.join(baseOut, guide.id) : baseOut;
    await exportGuide(guide, outDir, stepSeconds);
  }

  console.log('Open storyboard.html for a lightweight preview, or run video:knowledge for MP4 exports.');
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
