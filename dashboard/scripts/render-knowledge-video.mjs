#!/usr/bin/env node
import { chmod, mkdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { chromium } from '@playwright/test';
import { KNOWLEDGE_GUIDES } from '../src/data/knowledgeHub.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dashboardRoot = path.resolve(__dirname, '..');

function argValue(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index === -1 || !process.argv[index + 1]) return fallback;
  return process.argv[index + 1];
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

async function exists(file) {
  try {
    await stat(file);
    return true;
  } catch {
    return false;
  }
}

function easeOutCubic(t) {
  const x = Math.max(0, Math.min(1, t));
  return 1 - Math.pow(1 - x, 3);
}

function wrapText(text, maxChars) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function frameState(frames, time, stepSeconds) {
  const index = Math.min(frames.length - 1, Math.floor(time / stepSeconds));
  const local = (time - index * stepSeconds) / stepSeconds;
  const frame = frames[index];
  const prev = frames[Math.max(0, index - 1)] || frame;
  const move = easeOutCubic(Math.min(local / 0.18, 1));
  const pulse = local < 0.32 ? Math.sin((local / 0.32) * Math.PI) : 0;

  return {
    index,
    total: frames.length,
    screen: frame.screen,
    heading: frame.heading,
    subheading: frame.subheading,
    caption: frame.caption,
    focusId: frame.focusId,
    blocks: frame.blocks,
    cursor: {
      x: prev.cursor.x + (frame.cursor.x - prev.cursor.x) * move,
      y: prev.cursor.y + (frame.cursor.y - prev.cursor.y) * move,
    },
    focusScale: 1.08 + pulse * 0.025,
    progress: ((time + 1 / 12) / (frames.length * stepSeconds)) * 100,
  };
}

function pageTemplate() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      width: 1280px;
      height: 720px;
      overflow: hidden;
      background: #111928;
      color: #f8fafc;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .stage {
      position: relative;
      width: 1280px;
      height: 720px;
      overflow: hidden;
      background: linear-gradient(135deg, #111928, #162032);
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
      color: #94a3b8;
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
      color: #94a3b8;
    }
    .browser {
      position: absolute;
      left: 44px;
      right: 44px;
      top: 136px;
      bottom: 112px;
      border-radius: 18px;
      border: 1px solid #313d4f;
      overflow: hidden;
      background: #0f172a;
      box-shadow: 0 24px 80px rgba(0, 0, 0, 0.38);
    }
    .chrome {
      height: 38px;
      border-bottom: 1px solid #313d4f;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 0 18px;
      background: rgba(255, 255, 255, 0.04);
    }
    .dot { width: 10px; height: 10px; border-radius: 999px; }
    .screen-label {
      margin-left: 12px;
      color: #94a3b8;
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
      transform-origin: center;
    }
    .block.focus {
      z-index: 4;
      box-shadow: 0 22px 60px rgba(19, 41, 75, 0.38), 0 0 0 5px rgba(19, 41, 75, 0.18);
    }
    .block.nav { background: #13294b; color: white; border-color: rgba(255,255,255,0.12); }
    .block.action { background: #13294b; color: white; border-color: #13294b; }
    .block.pill { background: #e1eaf3; color: #13294b; }
    .block.chart { background: #dcfce7; }
    .block.calendar { background: #fef3c7; }
    .block.grid { background: #dbeafe; }
    .block.list { background: #f1f5f9; }
    .cursor {
      position: absolute;
      width: 31px;
      height: 31px;
      z-index: 8;
      color: #13294b;
      filter: drop-shadow(0 12px 18px rgba(0, 0, 0, 0.35));
    }
    .caption {
      position: absolute;
      left: 44px;
      right: 44px;
      bottom: 32px;
      min-height: 56px;
      border-radius: 14px;
      background: rgba(15, 23, 42, 0.88);
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
      border-radius: inherit;
      background: white;
    }
    .frame-count {
      position: absolute;
      right: 44px;
      top: 44px;
      color: #94a3b8;
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
      <h1 id="heading"></h1>
      <p id="subheading" class="subheading"></p>
    </div>
    <div class="frame-count" id="frame-count"></div>
    <section class="browser">
      <div class="chrome">
        <span class="dot" style="background:#f87171"></span>
        <span class="dot" style="background:#fbbf24"></span>
        <span class="dot" style="background:#34d399"></span>
        <span class="screen-label" id="screen-label"></span>
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
    window.renderDemoFrame = function renderDemoFrame(state) {
      const canvas = document.getElementById('canvas');
      canvas.className = 'canvas ' + (state.screen === 'dashboard' ? 'dashboard' : 'customer');
      canvas.innerHTML = state.blocks.map(function(block) {
        return '<div class="block ' + block.type + (block.id === state.focusId ? ' focus' : '') + '"></div>';
      }).join('');
      Array.from(canvas.children).forEach(function(node, index) {
        const block = state.blocks[index];
        const scale = block.id === state.focusId ? state.focusScale : 1;
        node.setAttribute('style', [
          'left:' + block.x + '%',
          'top:' + block.y + '%',
          'width:' + block.w + '%',
          'height:' + block.h + '%',
          'transform:scale(' + scale + ')'
        ].join(';'));
        node.textContent = block.label;
      });
      document.getElementById('heading').textContent = state.heading;
      document.getElementById('subheading').textContent = state.subheading;
      document.getElementById('caption').textContent = state.caption;
      document.getElementById('screen-label').textContent = state.screen === 'dashboard' ? 'Admin dashboard' : 'Customer site';
      document.getElementById('frame-count').textContent = (state.index + 1) + ' / ' + state.total;
      document.getElementById('cursor').style.left = state.cursor.x + '%';
      document.getElementById('cursor').style.top = state.cursor.y + '%';
      document.getElementById('bar').style.width = Math.max(0, Math.min(100, state.progress)) + '%';
    }
  </script>
</body>
</html>`;
}

async function createVoiceoverIfNeeded(outDir) {
  const higgsfieldPath = path.join(outDir, 'voiceover.mp3');
  const voiceoverPath = path.join(outDir, 'voiceover.aiff');
  if (await exists(higgsfieldPath)) return higgsfieldPath;
  if (await exists(voiceoverPath)) return voiceoverPath;
  return null;
}

async function renderGuide(guide, outDir, fps, stepSeconds) {
  const frames = guide.demo || [];
  if (!frames.length) throw new Error(`Guide "${guide.id}" has no demo frames.`);

  const frameDir = path.join(outDir, 'video-frames');
  await mkdir(frameDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  await page.setContent(pageTemplate(), { waitUntil: 'load' });

  const totalFrames = Math.round(frames.length * stepSeconds * fps);
  for (let i = 0; i < totalFrames; i += 1) {
    const time = i / fps;
    await page.evaluate((state) => window.renderDemoFrame(state), frameState(frames, time, stepSeconds));
    const filename = path.join(frameDir, `frame-${String(i + 1).padStart(5, '0')}.png`);
    await page.screenshot({ path: filename, type: 'png' });
    if ((i + 1) % fps === 0 || i === totalFrames - 1) {
      process.stdout.write(`Rendered ${i + 1}/${totalFrames} frames\r`);
    }
  }
  await browser.close();
  process.stdout.write(`Rendered ${totalFrames}/${totalFrames} frames\n`);

  const voiceoverPath = await createVoiceoverIfNeeded(outDir);
  const outputPath = path.join(outDir, `${guide.id}.mp4`);
  const ffmpegPath = ffmpegInstaller.path;
  await chmod(ffmpegPath, 0o755).catch(() => {});

  const args = [
    '-y',
    '-framerate', String(fps),
    '-i', path.join(frameDir, 'frame-%05d.png'),
  ];

  if (voiceoverPath) {
    args.push('-i', voiceoverPath);
  }

  args.push(
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-r', '30',
    '-movflags', '+faststart',
  );

  if (voiceoverPath) {
    args.push('-af', 'apad', '-c:a', 'aac', '-b:a', '160k', '-shortest');
  }

  args.push(outputPath);

  const result = spawnSync(ffmpegPath, args, { stdio: 'inherit' });
  if (result.status !== 0) {
    throw new Error('ffmpeg failed while encoding the MP4.');
  }

  await writeFile(
    path.join(outDir, 'video-readme.txt'),
    [
      `Video: ${outputPath}`,
      `Frames: ${frameDir}`,
      `Captions are burned into the video. captions.vtt is also available as a sidecar file.`,
      voiceoverPath ? `Voiceover: ${voiceoverPath}` : 'Voiceover: not found',
      '',
    ].join('\n'),
    'utf8',
  );

  console.log(`Knowledge demo MP4 written to ${outputPath}`);
}

async function main() {
  const all = process.argv.includes('--all');
  const guideId = argValue('--guide', 'customer-demo');
  const fps = Number(argValue('--fps', '12'));
  const stepSeconds = Number(argValue('--seconds', '6'));
  const defaultOut = all ? 'demo-output' : path.join('demo-output', guideId);
  const baseOut = path.resolve(dashboardRoot, argValue('--out', defaultOut));
  const guides = all
    ? KNOWLEDGE_GUIDES.filter((item) => item.demo?.length)
    : [KNOWLEDGE_GUIDES.find((item) => item.id === guideId)];

  if (guides.some((guide) => !guide)) {
    throw new Error(`Unknown guide "${guideId}".`);
  }

  for (const guide of guides) {
    const outDir = all ? path.join(baseOut, guide.id) : baseOut;
    await renderGuide(guide, outDir, fps, stepSeconds);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
