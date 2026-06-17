import { Phone, MessageSquare, Check, ChevronRight, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';
import { EASE, STAGGER } from '../../utils/motion';
import { brand, brandPhoneDigits } from '../../config/brand';
import { seoPages, type SeoPage } from '../../config/seoPages';
import Navbar from '../layout/Navbar';
import Footer from '../layout/Footer';

interface LandingPageProps {
  page: SeoPage;
  onNavigate: (section: string) => void;
  onBrowseFleet: () => void;
}

/**
 * Renders a high-intent SEO landing page from src/config/seoPages.ts.
 *
 * The SEO-critical copy (h1, intro, body, highlights, faqs) is the SAME data the
 * build-time prerender (vite.config.ts) writes into the static <body>, so the
 * crawlable HTML and this interactive render never drift. React's createRoot
 * replaces the prerendered markup on mount — no hydration, no mismatch.
 */
export default function LandingPage({ page, onNavigate, onBrowseFleet }: LandingPageProps) {
  return (
    <div style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      <Navbar onNavigate={onNavigate} />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 pt-28 sm:pt-32 pb-16 sm:pb-24">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="mb-6 text-xs" style={{ color: 'var(--text-tertiary)' }}>
          <button onClick={() => onNavigate('home')} className="hover:underline">Home</button>
          <span className="mx-2">/</span>
          <span style={{ color: 'var(--text-secondary)' }}>{page.serviceName}</span>
        </nav>

        {/* Hero */}
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-[11px] uppercase tracking-[0.3em] font-medium mb-4 block"
          style={{ color: 'var(--accent-color)' }}
        >
          {page.city} · {page.serviceName}
        </motion.span>
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ease: EASE.standard }}
          className="text-3xl sm:text-4xl md:text-5xl font-light tracking-tight leading-tight mb-5"
        >
          {page.h1}
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1, ease: EASE.standard }}
          className="text-base sm:text-lg leading-relaxed max-w-2xl mb-8"
          style={{ color: 'var(--text-secondary)' }}
        >
          {page.intro}
        </motion.p>

        {/* Primary CTAs */}
        <div className="flex flex-col sm:flex-row gap-3 mb-14 max-w-lg">
          <a
            href={`tel:${brandPhoneDigits}`}
            className="flex-1 py-3.5 rounded-full font-medium transition-all duration-500 hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2 text-sm"
            style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-fg)' }}
          >
            <Phone size={15} /> Call {brand.phone}
          </a>
          <a
            href={`sms:${brandPhoneDigits}`}
            className="flex-1 py-3.5 rounded-full font-medium border transition-all duration-500 hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2 text-sm"
            style={{ borderColor: 'var(--border-medium)', color: 'var(--text-secondary)' }}
          >
            <MessageSquare size={15} /> Text Us
          </a>
        </div>

        {/* Highlights */}
        <div className="grid sm:grid-cols-2 gap-4 mb-14">
          {page.highlights.map((h, i) => (
            <motion.div
              key={h.label}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * STAGGER.fast, ease: EASE.standard }}
              className="flex items-start gap-3 rounded-2xl border p-5"
              style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}
            >
              <span
                className="mt-0.5 shrink-0 w-6 h-6 rounded-full flex items-center justify-center"
                style={{ backgroundColor: 'var(--bg-card-hover)', border: '1px solid var(--border-subtle)' }}
              >
                <Check size={13} style={{ color: 'var(--accent-color)' }} />
              </span>
              <div>
                <h3 className="text-[15px] font-medium mb-1">{h.label}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{h.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Body copy */}
        <div className="space-y-5 max-w-2xl mb-14">
          {page.body.map((para, i) => (
            <p key={i} className="text-sm sm:text-base leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {para}
            </p>
          ))}
          <button
            onClick={onBrowseFleet}
            className="inline-flex items-center gap-2 text-sm font-medium pt-1 transition-colors"
            style={{ color: 'var(--accent-color)' }}
          >
            Browse our fleet <ArrowRight size={15} />
          </button>
        </div>

        {/* Page FAQ */}
        {page.faqs.length > 0 && (
          <section className="max-w-3xl">
            <h2 className="text-2xl sm:text-3xl font-light tracking-tight mb-6">Common Questions</h2>
            <div className="space-y-3">
              {page.faqs.map((faq) => (
                <details
                  key={faq.q}
                  className="group rounded-2xl border overflow-hidden"
                  style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}
                >
                  <summary className="p-5 cursor-pointer flex justify-between items-center list-none font-medium text-[14px] sm:text-[15px]">
                    {faq.q}
                    <ChevronRight size={16} className="transition-transform duration-300 group-open:rotate-90 shrink-0 ml-4" style={{ color: 'var(--text-tertiary)' }} />
                  </summary>
                  <div className="px-5 pb-5 leading-relaxed text-[14px] sm:text-[15px]" style={{ color: 'var(--text-secondary)' }}>
                    {faq.a}
                  </div>
                </details>
              ))}
            </div>
          </section>
        )}

        {/* Sibling cross-links — real <a href> for internal linking + crawl. */}
        {seoPages.length > 1 && (
          <section className="mt-14 pt-10" style={{ borderTop: '1px solid var(--border-subtle)' }}>
            <h2 className="text-[11px] uppercase tracking-[0.3em] font-medium mb-5" style={{ color: 'var(--accent-color)' }}>
              More rental options
            </h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {seoPages
                .filter((p) => p.slug !== page.slug)
                .map((p) => (
                  <a
                    key={p.slug}
                    href={`/${p.slug}`}
                    className="flex items-center justify-between rounded-2xl border p-4 transition-colors hover:border-[var(--border-medium)]"
                    style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}
                  >
                    <span className="text-sm font-medium">{p.serviceName} in {p.city}</span>
                    <ChevronRight size={16} style={{ color: 'var(--text-tertiary)' }} />
                  </a>
                ))}
            </div>
          </section>
        )}
      </main>

      <Footer />
    </div>
  );
}
