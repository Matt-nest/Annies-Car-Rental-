import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  BookOpenCheck,
  Captions,
  CheckCircle2,
  CircleHelp,
  Clock3,
  Download,
  MonitorPlay,
  PlayCircle,
  Search,
  Sparkles,
  Volume2,
} from 'lucide-react';
import GuidedDemoPlayer from '../components/knowledge/GuidedDemoPlayer';
import { GUIDE_CATEGORIES, KNOWLEDGE_GUIDES, getGuideSearchMatches, searchGuides } from '../data/knowledgeHub';

function categoryLabel(category) {
  return GUIDE_CATEGORIES.find((item) => item.id === category)?.label || category;
}

function GuideCard({ guide, active, matches, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(guide)}
      className="w-full text-left rounded-xl border p-4 transition-all duration-200"
      style={{
        backgroundColor: active ? 'var(--sidebar-active-bg)' : 'var(--bg-card)',
        borderColor: active ? 'var(--accent-color)' : 'var(--border-subtle)',
        boxShadow: active ? 'var(--shadow-md)' : 'var(--shadow-xs)',
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold uppercase tracking-[0.12em]"
              style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
            >
              {categoryLabel(guide.category)}
            </span>
            <span className="inline-flex items-center gap-1 text-xs text-[var(--text-tertiary)]">
              <Clock3 size={13} />
              {guide.time}
            </span>
          </div>
          <h3 className="mt-3 text-sm sm:text-base font-semibold text-[var(--text-primary)]">
            {guide.title}
          </h3>
          {active && (
            <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
              {guide.summary}
            </p>
          )}
          {matches.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {matches.map((match) => (
                <span
                  key={match}
                  className="rounded-full px-2 py-1 text-[11px] font-semibold"
                  style={{
                    backgroundColor: active ? 'rgba(255,255,255,0.16)' : 'var(--bg-secondary)',
                    color: active ? '#FFFFFF' : 'var(--text-tertiary)',
                  }}
                >
                  Matched: {match}
                </span>
              ))}
            </div>
          )}
        </div>
        <PlayCircle
          size={20}
          className="shrink-0"
          style={{ color: active ? '#FFFFFF' : 'var(--accent-color)' }}
        />
      </div>
    </button>
  );
}

function EmptyResults({ onReset }) {
  return (
    <div
      className="rounded-xl border p-6 text-center"
      style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}
    >
      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-[var(--bg-secondary)]">
        <Search size={19} className="text-[var(--text-secondary)]" />
      </div>
      <h3 className="mt-3 text-sm font-semibold text-[var(--text-primary)]">No guide found</h3>
      <p className="mt-1 text-sm text-[var(--text-secondary)]">
        Try a broader search like payment, pickup, customer, or fleet.
      </p>
      <button type="button" className="btn-secondary mt-4 h-9 px-3" onClick={onReset}>
        Clear search
      </button>
    </div>
  );
}

function FullDemoVideo({ video }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [video?.src]);

  if (!video) return null;

  return (
    <section
      className="rounded-xl border p-4 sm:p-5"
      style={{
        backgroundColor: 'var(--bg-card)',
        borderColor: 'var(--border-subtle)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <MonitorPlay size={19} className="text-[var(--accent-color)]" />
            <h3 className="text-base font-semibold text-[var(--text-primary)]">{video.title}</h3>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">
            {failed ? 'Exported MP4 not found yet. Run the real UI capture and render scripts for this guide.' : video.description}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[var(--text-tertiary)]">
          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--bg-secondary)] px-2.5 py-1">
            <Captions size={14} />
            Captions
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--bg-secondary)] px-2.5 py-1">
            <Volume2 size={14} />
            Voiceover
          </span>
          <a className="btn-secondary h-8 gap-2 px-3" href={video.src} download>
            <Download size={14} />
            MP4
          </a>
        </div>
      </div>
      {!failed && (
        <video
          className="mt-4 w-full overflow-hidden rounded-xl border bg-black"
          style={{ borderColor: 'var(--border-subtle)' }}
          controls
          preload="metadata"
          onError={() => setFailed(true)}
        >
          <source src={video.src} type="video/mp4" />
          {video.captions && (
            <track kind="captions" src={video.captions} srcLang="en" label="English" default />
          )}
        </video>
      )}
    </section>
  );
}

function guideVideo(guide) {
  if (!guide) return null;
  if (guide.fullVideo) return guide.fullVideo;
  return {
    src: `/knowledge-videos/${guide.id}.mp4`,
    captions: `/knowledge-videos/${guide.id}.vtt`,
    title: 'Real UI screen recording',
    description: 'Actual app recording with captions. Exported from Playwright real UI capture.',
  };
}

export default function KnowledgeHubPage() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [showAllResults, setShowAllResults] = useState(false);
  const [detailTab, setDetailTab] = useState('steps');
  const results = useMemo(() => searchGuides(query, category), [query, category]);
  const [selectedId, setSelectedId] = useState(KNOWLEDGE_GUIDES[0]?.id);
  const visibleResults = showAllResults ? results : results.slice(0, 6);

  const selectedGuide = useMemo(() => {
    if (results.some((guide) => guide.id === selectedId)) {
      return results.find((guide) => guide.id === selectedId);
    }
    return results[0] || KNOWLEDGE_GUIDES[0];
  }, [results, selectedId]);

  const selectGuide = (guide) => {
    setSelectedId(guide.id);
    setDetailTab('steps');
  };

  const resetSearch = () => {
    setQuery('');
    setCategory('all');
    setShowAllResults(false);
    setDetailTab('steps');
    setSelectedId(KNOWLEDGE_GUIDES[0]?.id);
  };

  useEffect(() => {
    setShowAllResults(false);
  }, [query, category]);

  return (
    <div className="page-shell">
      <div className="mx-auto flex max-w-[1500px] flex-col gap-5">
        <section
          className="rounded-xl border p-4 sm:p-5"
          style={{
            backgroundColor: 'var(--bg-card)',
            borderColor: 'var(--border-subtle)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.14em]"
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    borderColor: 'var(--border-subtle)',
                    color: 'var(--text-primary)',
                  }}
                >
                  <CircleHelp size={14} />
                  Built-in training hub
                </span>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--text-tertiary)]">
                  <Captions size={14} />
                  Captions
                </span>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--text-tertiary)]">
                  <Volume2 size={14} />
                  Voiceover
                </span>
              </div>
              <h1 className="mt-3 text-2xl sm:text-3xl font-bold tracking-normal text-[var(--text-primary)]">
                Knowledge Hub
              </h1>
              <p className="mt-2 max-w-2xl text-sm sm:text-base leading-7 text-[var(--text-secondary)]">
                Search the task, open one guide, follow the checklist, then watch the walkthrough.
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-[410px_minmax(0,1fr)]">
          <aside className="flex flex-col gap-4">
            <div
              className="rounded-xl border p-3"
              style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}
            >
              <label className="label" htmlFor="knowledge-search">Search guides</label>
              <div className="relative">
                <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
                <input
                  id="knowledge-search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="input pl-10"
                  placeholder="Try pickup, payment, customer, refund..."
                />
              </div>

              <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                {GUIDE_CATEGORIES.map((item) => {
                  const active = item.id === category;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setCategory(item.id)}
                      className="h-9 shrink-0 rounded-lg px-3 text-xs font-bold transition-colors"
                      style={{
                        backgroundColor: active ? 'var(--accent-color)' : 'var(--bg-secondary)',
                        color: active ? '#FFFFFF' : 'var(--text-secondary)',
                        border: `1px solid ${active ? 'var(--accent-color)' : 'var(--border-subtle)'}`,
                      }}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between px-1">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                {results.length} result{results.length === 1 ? '' : 's'}
              </p>
              {(query || category !== 'all') && (
                <button type="button" className="text-xs font-semibold text-[var(--accent-color)]" onClick={resetSearch}>
                  Reset
                </button>
              )}
            </div>

            <div className="flex flex-col gap-3">
              {results.length ? (
                visibleResults.map((guide) => (
                  <GuideCard
                    key={guide.id}
                    guide={guide}
                    active={guide.id === selectedGuide?.id}
                    matches={getGuideSearchMatches(guide, query)}
                    onSelect={selectGuide}
                  />
                ))
              ) : (
                <EmptyResults onReset={resetSearch} />
              )}
              {results.length > visibleResults.length && (
                <button
                  type="button"
                  className="btn-secondary h-10 justify-center"
                  onClick={() => setShowAllResults(true)}
                >
                  Show {results.length - visibleResults.length} more
                </button>
              )}
            </div>
          </aside>

          <main className="min-w-0">
            {selectedGuide && (
              <div className="flex flex-col gap-5">
                <section
                  className="rounded-xl border p-4 sm:p-5"
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    borderColor: 'var(--border-subtle)',
                    boxShadow: 'var(--shadow-sm)',
                  }}
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-[0.12em]"
                          style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
                        >
                          {categoryLabel(selectedGuide.category)}
                        </span>
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--text-tertiary)]">
                          <Clock3 size={13} />
                          {selectedGuide.time}
                        </span>
                      </div>
                      <h2 className="mt-3 text-xl sm:text-2xl font-bold text-[var(--text-primary)]">
                        {selectedGuide.title}
                      </h2>
                      <p className="mt-2 max-w-3xl text-sm leading-7 text-[var(--text-secondary)]">
                        {selectedGuide.summary}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {selectedGuide.routePath && selectedGuide.category !== 'customer' && (
                        <Link className="btn-secondary h-9 gap-2 px-3" to={selectedGuide.routePath}>
                          <ArrowRight size={15} />
                          <span>{selectedGuide.routeLabel}</span>
                        </Link>
                      )}
                      <button
                        type="button"
                        className="btn-primary h-9 gap-2 px-3"
                        onClick={() => {
                          setDetailTab('video');
                          window.setTimeout(() => {
                            document.getElementById('knowledge-demo')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                          }, 0);
                        }}
                      >
                        <MonitorPlay size={15} />
                        <span>Watch demo</span>
                      </button>
                    </div>
                  </div>

                  <div
                    className="mt-4 rounded-lg border px-4 py-3"
                    style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)' }}
                  >
                    <div className="flex items-start gap-3">
                      <Sparkles size={18} className="mt-0.5 shrink-0 text-[var(--accent-color)]" />
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">Outcome</p>
                        <p className="mt-1 text-sm font-medium leading-6 text-[var(--text-primary)]">{selectedGuide.outcome}</p>
                      </div>
                    </div>
                  </div>
                </section>

                <section
                  className="rounded-xl border p-4 sm:p-5"
                  style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}
                >
                  <div className="flex flex-wrap gap-2">
                    {[
                      ['steps', 'Checklist'],
                      ['video', 'Video'],
                    ].map(([id, label]) => {
                      const active = detailTab === id;
                      return (
                        <button
                          key={id}
                          type="button"
                          className="h-9 rounded-lg px-3 text-sm font-bold transition-colors"
                          onClick={() => setDetailTab(id)}
                          style={{
                            backgroundColor: active ? 'var(--accent-color)' : 'var(--bg-secondary)',
                            color: active ? '#FFFFFF' : 'var(--text-secondary)',
                            border: `1px solid ${active ? 'var(--accent-color)' : 'var(--border-subtle)'}`,
                          }}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>

                  {detailTab === 'steps' ? (
                    <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
                      <div>
                        <div className="flex items-center gap-2">
                          <BookOpenCheck size={19} className="text-[var(--accent-color)]" />
                          <h3 className="text-base font-semibold text-[var(--text-primary)]">Do this</h3>
                        </div>
                        {selectedGuide.beforeStart && (
                          <div
                            className="mt-4 rounded-lg border px-3 py-3 text-sm leading-6"
                            style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}
                          >
                            <span className="font-semibold text-[var(--text-primary)]">Before: </span>
                            {selectedGuide.beforeStart}
                          </div>
                        )}
                        <ol className="mt-4 space-y-3">
                          {selectedGuide.steps.map((step, index) => (
                            <li key={step} className="flex gap-3">
                              <span
                                className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                                style={{ backgroundColor: 'var(--accent-color)', color: '#FFFFFF' }}
                              >
                                {index + 1}
                              </span>
                              <span className="text-sm leading-6 text-[var(--text-secondary)]">{step}</span>
                            </li>
                          ))}
                        </ol>
                      </div>

                      <div>
                        {(selectedGuide.doneWhen || selectedGuide.escalateIf) && (
                          <div className="mb-4 space-y-3">
                            {selectedGuide.doneWhen && (
                              <div
                                className="rounded-lg border px-3 py-3 text-sm leading-6"
                                style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)' }}
                              >
                                <div className="flex items-center gap-2 font-semibold text-[var(--text-primary)]">
                                  <CheckCircle2 size={16} className="text-[var(--success-color)]" />
                                  Done when
                                </div>
                                <p className="mt-1 text-[var(--text-secondary)]">{selectedGuide.doneWhen}</p>
                              </div>
                            )}
                            {selectedGuide.escalateIf && (
                              <div
                                className="rounded-lg border px-3 py-3 text-sm leading-6"
                                style={{ backgroundColor: 'var(--warning-glow)', borderColor: 'rgba(245, 158, 11, 0.24)' }}
                              >
                                <div className="flex items-center gap-2 font-semibold text-[var(--text-primary)]">
                                  <AlertTriangle size={16} className="text-[var(--warning-color)]" />
                                  Escalate if
                                </div>
                                <p className="mt-1 text-[var(--text-secondary)]">{selectedGuide.escalateIf}</p>
                              </div>
                            )}
                          </div>
                        )}
                        {selectedGuide.doNotProceedIf?.length > 0 && (
                          <div
                            className="mb-4 rounded-lg border px-3 py-3 text-sm leading-6"
                            style={{ backgroundColor: 'rgba(239, 68, 68, 0.08)', borderColor: 'rgba(239, 68, 68, 0.24)' }}
                          >
                            <div className="flex items-center gap-2 font-semibold text-[var(--text-primary)]">
                              <AlertTriangle size={16} className="text-[var(--danger-color)]" />
                              Do not proceed if
                            </div>
                            <ul className="mt-2 space-y-2">
                              {selectedGuide.doNotProceedIf.map((blocker) => (
                                <li key={blocker} className="flex gap-2 text-[var(--text-secondary)]">
                                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
                                  <span>{blocker}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <CheckCircle2 size={19} className="text-[var(--success-color)]" />
                          <h3 className="text-base font-semibold text-[var(--text-primary)]">Watch for</h3>
                        </div>
                        <div className="mt-4 space-y-3">
                          {selectedGuide.tips.map((tip) => (
                            <div
                              key={tip}
                              className="rounded-lg border px-3 py-3 text-sm leading-6 text-[var(--text-secondary)]"
                              style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)' }}
                            >
                              {tip}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div id="knowledge-demo" className="mt-5 scroll-mt-24 space-y-5">
                      <FullDemoVideo video={guideVideo(selectedGuide)} />
                      <GuidedDemoPlayer guide={selectedGuide} />
                    </div>
                  )}
                </section>
              </div>
            )}
          </main>
        </section>
      </div>
    </div>
  );
}
