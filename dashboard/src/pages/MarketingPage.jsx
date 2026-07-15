import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import qrcode from 'qrcode-generator';
import {
  BadgeDollarSign,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Image,
  Loader2,
  MapPinned,
  Megaphone,
  Palette,
  Printer,
  QrCode,
  RefreshCw,
  Share2,
  Sparkles,
  Star,
  Tags,
  Users,
} from 'lucide-react';
import brand from '../config/brand';
import { marketingApi } from '../api/marketing';
import DataError from '../components/shared/DataError';
import EmptyState from '../components/shared/EmptyState';
import { SkeletonTable } from '../components/shared/Skeleton';
import InlineBanner from '../components/shared/InlineBanner';

const EASE = [0.25, 1, 0.5, 1];
const DIRECT_RENTAL_PAGE = `${brand.siteUrl}/`;
const RIDESHARE_PAGE = `${brand.siteUrl}/drive.html`;
const APPLICATIONS_PAGE = `${brand.siteUrl}/applications.html`;

const DESIGN_PRINT_ASSETS = [
  { key: 'logo_marks', number: '01', title: 'Logo Marks', spec: 'SVG + PNG lockups', use: 'Use across social, print, decals, app icons, and local partner materials.', icon: Palette, href: '/brand/annies-wordmark-charcoal.svg', defaultMedium: 'brand' },
  { key: 'direct_booking_card', number: '02', title: 'Direct Booking Card', spec: '3.5 x 2 in', use: 'Small card for repeat renters, hotels, service centers, body shops, and hand-to-hand referrals.', icon: Users, href: DIRECT_RENTAL_PAGE, defaultMedium: 'print' },
  { key: 'fleet_flyer', number: '03', title: 'Fleet Flyer', spec: '4 x 6 in', use: 'Countertop flyer that sends renters straight to the live fleet and booking flow.', icon: FileText, href: DIRECT_RENTAL_PAGE, defaultMedium: 'print' },
  { key: 'offer_card', number: '04', title: 'Return Renter Offer', spec: '$25 off next rental', use: 'Retention insert for completed rentals and referral follow-up.', icon: BadgeDollarSign, href: DIRECT_RENTAL_PAGE, defaultMedium: 'retention' },
  { key: 'rideshare_flyer', number: '05', title: 'Rideshare Flyer', spec: 'Uber/Lyft/Delivery drivers', use: 'Driver-focused acquisition for Uber, Lyft, DoorDash, Instacart, Amazon Flex, and courier work.', icon: MapPinned, href: RIDESHARE_PAGE, defaultMedium: 'print' },
  { key: 'rideshare_application_card', number: '06', title: 'Driver Application Card', spec: 'QR to application', use: 'Handout for drivers who need weekly/monthly rental options and should apply before calling.', icon: Share2, href: APPLICATIONS_PAGE, defaultMedium: 'print' },
  { key: 'vehicle_window_qr', number: '07', title: 'Vehicle Window QR', spec: '4 in round vinyl', use: 'Vehicle/window QR decal to turn local impressions into booking visits.', icon: QrCode, href: DIRECT_RENTAL_PAGE, defaultMedium: 'decal' },
  { key: 'review_card', number: '08', title: 'Review Request Card', spec: 'Post-return insert', use: 'Send happy renters to the review link while the handoff experience is still fresh.', icon: Star, href: brand.reviewLink, defaultMedium: 'review' },
  { key: 'app_icon_sticker', number: '09', title: 'App Icon Sticker', spec: '3 in die-cut', use: 'Brand sticker/decal for vehicles, key packets, partner counters, and welcome kits.', icon: Image, href: '/logo-icon.png', defaultMedium: 'sticker' },
];

const BRAND_FILES = [
  { name: 'Charcoal wordmark', path: '/brand/annies-wordmark-charcoal.svg', format: 'SVG' },
  { name: 'White wordmark', path: '/brand/annies-wordmark-white.svg', format: 'SVG' },
  { name: 'Primary logo', path: '/logo.png', format: 'PNG' },
  { name: 'Icon mark', path: '/logo-icon.png', format: 'PNG' },
  { name: 'Apple touch icon', path: '/apple-touch-icon.png', format: 'PNG' },
  { name: 'PWA icon 512', path: '/web-app-manifest-512x512.png', format: 'PNG' },
];

const WORKING_PRINT_FILES = [
  { name: 'Direct booking site', path: '/', type: 'LIVE', preview: DIRECT_RENTAL_PAGE },
  { name: 'Rideshare driver landing page', path: '/drive.html', type: 'HTML', preview: RIDESHARE_PAGE },
  { name: 'Driver application gate', path: '/applications.html', type: 'HTML', preview: APPLICATIONS_PAGE },
  { name: 'Rideshare hero image', path: '/rideshare-driver.jpeg', type: 'JPG', preview: '/rideshare-driver.jpeg' },
  { name: 'Happy driver image', path: '/happy-driver.png', type: 'PNG', preview: '/happy-driver.png' },
  { name: 'Homepage poster', path: '/hero-poster.jpg', type: 'JPG', preview: '/hero-poster.jpg' },
  { name: 'Fleet hero sample', path: '/hero-sentra-front.png', type: 'PNG', preview: '/hero-sentra-front.png' },
];

const STATUS_OPTIONS = ['planned', 'active', 'paused', 'complete'];

const initialCampaign = {
  name: 'Rideshare driver push',
  audience: 'Uber, Lyft, DoorDash, and courier drivers',
  channel: 'print',
  offer: 'Weekly rentals with direct support',
  status: 'planned',
  goal: 'Generate long-term rental leads',
  startDate: '',
  endDate: '',
  budget: '',
  notes: '',
};

const initialReferral = {
  name: '',
  type: 'customer',
  offer: '$25 off next rental',
  reward: '$25 credit after completed rental',
  notes: '',
};

function money(n) {
  return `$${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function makeQrSvg(value) {
  const qr = qrcode(0, 'M');
  qr.addData(value || brand.siteUrl);
  qr.make();
  return qr.createSvgTag(5, 2);
}

function downloadText(filename, content, type = 'image/svg+xml') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function copyText(value) {
  await navigator.clipboard.writeText(value);
}

function StatTile({ icon: Icon, label, value, subtext }) {
  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">{label}</p>
        <Icon size={16} className="text-[var(--accent-color)]" />
      </div>
      <p className="mt-2 text-2xl font-bold text-[var(--text-primary)]">{value}</p>
      {subtext && <p className="mt-0.5 text-xs text-[var(--text-secondary)]">{subtext}</p>}
    </div>
  );
}

function StatusSelect({ value, onChange }) {
  return (
    <select className="input text-xs py-2" value={value} onChange={(e) => onChange(e.target.value)}>
      {STATUS_OPTIONS.map(status => <option key={status} value={status}>{status}</option>)}
    </select>
  );
}

function AssetCard({ asset, onUse }) {
  const Icon = asset.icon;
  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-2 text-[var(--accent-color)]">
            <Icon size={17} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">Asset {asset.number}</p>
            <h3 className="mt-1 text-sm font-bold text-[var(--text-primary)]">{asset.title}</h3>
            <p className="mt-0.5 text-xs font-semibold text-[var(--accent-color)]">{asset.spec}</p>
          </div>
        </div>
      </div>
      <p className="mt-3 min-h-[3rem] text-xs leading-relaxed text-[var(--text-secondary)]">{asset.use}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <a href={asset.href} target="_blank" rel="noopener noreferrer" className="btn-ghost text-xs py-1.5">
          Preview <ExternalLink size={12} />
        </a>
        <button type="button" className="btn-secondary text-xs py-1.5" onClick={() => onUse(asset)}>
          <QrCode size={12} /> Build QR
        </button>
      </div>
    </div>
  );
}

function BrandFileRow({ item }) {
  return (
    <a
      href={item.path}
      target="_blank"
      rel="noopener noreferrer"
      download
      className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-3 py-2.5 transition-colors hover:bg-[var(--bg-card-hover)]"
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{item.name}</p>
        <p className="truncate text-[11px] text-[var(--text-tertiary)]">{item.path}</p>
      </div>
      <span className="rounded-md bg-[var(--bg-card-hover)] px-2 py-1 text-[10px] font-bold text-[var(--text-secondary)]">{item.format}</span>
    </a>
  );
}

function QrPanel({ link, onCopied }) {
  if (!link) {
    return (
      <div className="card p-5 text-center">
        <QrCode size={28} className="mx-auto text-[var(--text-tertiary)]" />
        <p className="mt-2 text-sm font-semibold text-[var(--text-primary)]">No QR selected</p>
        <p className="mt-1 text-xs text-[var(--text-secondary)]">Create a campaign link or choose one below to preview the QR code.</p>
      </div>
    );
  }
  const svg = makeQrSvg(link.trackingUrl || link.utmUrl);
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">Selected QR</p>
          <h2 className="mt-1 text-base font-bold text-[var(--text-primary)]">{link.name}</h2>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">{link.campaignName}</p>
        </div>
        <span className="rounded-full border border-[var(--border-subtle)] px-2 py-1 text-[10px] font-bold text-[var(--text-secondary)]">
          {link.clicks || 0} scans
        </span>
      </div>
      <div className="mt-4 rounded-xl border border-[var(--border-subtle)] bg-white p-4">
        <div className="mx-auto w-full max-w-[220px] text-black [&_svg]:h-full [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
      </div>
      <div className="mt-4 space-y-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">Tracking URL</p>
          <p className="mt-1 break-all rounded-lg bg-[var(--bg-primary)] p-2 text-xs text-[var(--text-secondary)]">{link.trackingUrl}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-secondary text-xs" onClick={() => copyText(link.trackingUrl).then(() => onCopied('Tracking URL copied'))}>
            <Copy size={12} /> Copy link
          </button>
          <button type="button" className="btn-secondary text-xs" onClick={() => copyText(svg).then(() => onCopied('QR SVG copied'))}>
            <Copy size={12} /> Copy SVG
          </button>
          <button type="button" className="btn-primary text-xs" onClick={() => downloadText(`${link.shortCode || 'marketing-qr'}.svg`, svg)}>
            <Download size={12} /> Download QR
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MarketingPage() {
  const [workspace, setWorkspace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [campaignForm, setCampaignForm] = useState(initialCampaign);
  const [linkForm, setLinkForm] = useState({
    campaignId: '',
    assetKey: 'general_business_card',
    name: 'General business card QR',
    destinationUrl: brand.siteUrl,
    channel: 'print',
  });
  const [referralForm, setReferralForm] = useState(initialReferral);
  const [submitting, setSubmitting] = useState('');
  const [selectedLinkId, setSelectedLinkId] = useState(null);

  const campaigns = workspace?.campaigns || [];
  const links = workspace?.links || [];
  const referrals = workspace?.referrals || [];
  const summary = workspace?.summary || {};
  const selectedLink = useMemo(
    () => links.find(link => link.id === selectedLinkId) || links[0] || null,
    [links, selectedLinkId]
  );

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await marketingApi.getWorkspace();
      setWorkspace(data);
      setSelectedLinkId(prev => prev || data.links?.[0]?.id || null);
    } catch (err) {
      setError(err.message || 'Could not load marketing workspace');
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  function flash(message) {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 2200);
  }

  function chooseAsset(asset) {
    setLinkForm(prev => ({
      ...prev,
      assetKey: asset.key,
      name: `${asset.title} QR`,
      channel: asset.defaultMedium,
    }));
    flash(`${asset.title} loaded into QR builder`);
    document.getElementById('qr-builder')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function createCampaign(e) {
    e.preventDefault();
    setSubmitting('campaign');
    setError('');
    try {
      const data = await marketingApi.createCampaign(campaignForm);
      setWorkspace(data.workspace);
      setCampaignForm(initialCampaign);
      flash('Campaign saved');
    } catch (err) {
      setError(err.message);
    }
    setSubmitting('');
  }

  async function updateCampaignStatus(campaign, status) {
    try {
      const data = await marketingApi.updateCampaign(campaign.id, { status });
      setWorkspace(data.workspace);
      flash('Campaign updated');
    } catch (err) {
      setError(err.message);
    }
  }

  async function createLink(e) {
    e.preventDefault();
    setSubmitting('link');
    setError('');
    try {
      const data = await marketingApi.createLink(linkForm);
      setWorkspace(data.workspace);
      setSelectedLinkId(data.link.id);
      flash('QR campaign link created');
    } catch (err) {
      setError(err.message);
    }
    setSubmitting('');
  }

  async function createReferral(e) {
    e.preventDefault();
    setSubmitting('referral');
    setError('');
    try {
      const data = await marketingApi.createReferral(referralForm);
      setWorkspace(data.workspace);
      setReferralForm(initialReferral);
      flash('Referral code saved');
    } catch (err) {
      setError(err.message);
    }
    setSubmitting('');
  }

  return (
    <div className="page-shell lg:p-8 space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE }}
        className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"
      >
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--accent-color)]">Growth operations</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--text-primary)]">Marketing Workspace</h1>
          <p className="mt-1 max-w-2xl text-sm text-[var(--text-secondary)]">
            Build local campaigns, create scannable QR links, manage referral codes, and keep print assets tied to trackable booking demand.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-secondary" onClick={load}>
            <RefreshCw size={14} /> Refresh
          </button>
          <a href={RIDESHARE_PAGE} target="_blank" rel="noopener noreferrer" className="btn-primary">
            <ExternalLink size={14} /> Open rideshare page
          </a>
        </div>
      </motion.div>

      <DataError message={error} onRetry={load} />
      <InlineBanner message={notice} onDismiss={() => setNotice('')} />
      {workspace && workspace.persistent === false && (
        <InlineBanner message="Marketing tables are not initialized in this environment, so changes cannot persist here." />
      )}

      {loading ? (
        <SkeletonTable rows={5} cols={4} />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <StatTile icon={ClipboardList} label="Campaigns" value={summary.campaigns || 0} subtext={`${summary.activeCampaigns || 0} active`} />
            <StatTile icon={QrCode} label="QR Links" value={summary.links || 0} subtext={`${summary.totalClicks || 0} scans/clicks`} />
            <StatTile icon={Users} label="Referrals" value={summary.referrals || 0} subtext={`${money(summary.referralRevenue)} tracked`} />
            <StatTile icon={CheckCircle2} label="Bookings" value={summary.totalBookings || 0} subtext="manual attribution for now" />
            <StatTile icon={Palette} label="Assets" value={DESIGN_PRINT_ASSETS.length} subtext="design/print pack" />
          </div>

          <section className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_420px]">
            <div className="space-y-5">
              <div className="card p-5">
                <div className="flex items-center gap-2">
                  <ClipboardList size={16} className="text-[var(--accent-color)]" />
                  <h2 className="text-base font-bold text-[var(--text-primary)]">Campaign Planner</h2>
                </div>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">Plan offers by audience and channel, then connect print/social assets to trackable links.</p>
                <form onSubmit={createCampaign} className="mt-4 grid gap-3 lg:grid-cols-2">
                  <div>
                    <label className="label">Campaign name</label>
                    <input className="input" required value={campaignForm.name} onChange={e => setCampaignForm({ ...campaignForm, name: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">Audience</label>
                    <input className="input" value={campaignForm.audience} onChange={e => setCampaignForm({ ...campaignForm, audience: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">Channel</label>
                    <input className="input" value={campaignForm.channel} onChange={e => setCampaignForm({ ...campaignForm, channel: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">Offer</label>
                    <input className="input" value={campaignForm.offer} onChange={e => setCampaignForm({ ...campaignForm, offer: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">Goal</label>
                    <input className="input" value={campaignForm.goal} onChange={e => setCampaignForm({ ...campaignForm, goal: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">Status</label>
                    <StatusSelect value={campaignForm.status} onChange={status => setCampaignForm({ ...campaignForm, status })} />
                  </div>
                  <button type="submit" className="btn-primary justify-center lg:col-span-2" disabled={submitting === 'campaign'}>
                    {submitting === 'campaign' ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                    Save campaign
                  </button>
                </form>
              </div>

              <div className="card p-5" id="qr-builder">
                <div className="flex items-center gap-2">
                  <QrCode size={16} className="text-[var(--accent-color)]" />
                  <h2 className="text-base font-bold text-[var(--text-primary)]">QR & UTM Link Builder</h2>
                </div>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">Create a scannable tracking link for any flyer, card, sticker, partner kit, or campaign.</p>
                <form onSubmit={createLink} className="mt-4 grid gap-3 lg:grid-cols-2">
                  <div>
                    <label className="label">Campaign</label>
                    <select className="input" value={linkForm.campaignId} onChange={e => setLinkForm({ ...linkForm, campaignId: e.target.value })}>
                      <option value="">No campaign / direct</option>
                      {campaigns.map(campaign => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Asset</label>
                    <select className="input" value={linkForm.assetKey} onChange={e => setLinkForm({ ...linkForm, assetKey: e.target.value })}>
                      {DESIGN_PRINT_ASSETS.map(asset => <option key={asset.key} value={asset.key}>{asset.title}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Link name</label>
                    <input className="input" required value={linkForm.name} onChange={e => setLinkForm({ ...linkForm, name: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">Medium/channel</label>
                    <input className="input" value={linkForm.channel} onChange={e => setLinkForm({ ...linkForm, channel: e.target.value })} />
                  </div>
                  <div className="lg:col-span-2">
                    <label className="label">Destination URL</label>
                    <input className="input" type="url" required value={linkForm.destinationUrl} onChange={e => setLinkForm({ ...linkForm, destinationUrl: e.target.value })} />
                  </div>
                  <button type="submit" className="btn-primary justify-center lg:col-span-2" disabled={submitting === 'link'}>
                    {submitting === 'link' ? <Loader2 size={14} className="animate-spin" /> : <QrCode size={14} />}
                    Create QR link
                  </button>
                </form>
              </div>
            </div>

            <div className="space-y-5">
              <QrPanel link={selectedLink} onCopied={flash} />
              <div className="card p-5">
                <div className="flex items-center gap-2">
                  <Tags size={16} className="text-[var(--accent-color)]" />
                  <h2 className="text-base font-bold text-[var(--text-primary)]">Referral Engine</h2>
                </div>
                <form onSubmit={createReferral} className="mt-4 space-y-3">
                  <div>
                    <label className="label">Referrer or partner</label>
                    <input className="input" required placeholder="Customer, body shop, hotel..." value={referralForm.name} onChange={e => setReferralForm({ ...referralForm, name: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">Type</label>
                      <select className="input" value={referralForm.type} onChange={e => setReferralForm({ ...referralForm, type: e.target.value })}>
                        <option value="customer">Customer</option>
                        <option value="partner">Partner</option>
                        <option value="staff">Staff</option>
                      </select>
                    </div>
                    <div>
                      <label className="label">Offer</label>
                      <input className="input" value={referralForm.offer} onChange={e => setReferralForm({ ...referralForm, offer: e.target.value })} />
                    </div>
                  </div>
                  <div>
                    <label className="label">Reward</label>
                    <input className="input" value={referralForm.reward} onChange={e => setReferralForm({ ...referralForm, reward: e.target.value })} />
                  </div>
                  <button type="submit" className="btn-secondary w-full justify-center" disabled={submitting === 'referral'}>
                    {submitting === 'referral' ? <Loader2 size={14} className="animate-spin" /> : <Users size={14} />}
                    Create referral code
                  </button>
                </form>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-base font-bold text-[var(--text-primary)]">Campaigns</h2>
                <p className="text-sm text-[var(--text-secondary)]">Active, planned, paused, and completed demand-generation plays.</p>
              </div>
            </div>
            {campaigns.length === 0 ? (
              <EmptyState icon={Megaphone} title="No campaigns yet" description="Create the first campaign above, then attach QR links and assets." />
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {campaigns.map(campaign => (
                  <article key={campaign.id} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-[var(--text-primary)]">{campaign.name}</h3>
                        <p className="mt-1 text-xs text-[var(--text-secondary)]">{campaign.audience}</p>
                        <p className="mt-2 text-xs font-semibold text-[var(--accent-color)]">{campaign.offer || campaign.goal}</p>
                      </div>
                      <span className="rounded-full border border-[var(--border-subtle)] px-2 py-1 text-[10px] font-bold uppercase text-[var(--text-secondary)]">{campaign.status}</span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-[var(--text-secondary)]">
                      <div className="rounded-lg bg-[var(--bg-primary)] p-2">Channel: <strong>{campaign.channel}</strong></div>
                      <div className="rounded-lg bg-[var(--bg-primary)] p-2">Budget: <strong>{money(campaign.budget)}</strong></div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {STATUS_OPTIONS.map(status => (
                        <button key={status} type="button" className="btn-ghost text-xs py-1.5" onClick={() => updateCampaignStatus(campaign, status)}>
                          {status}
                        </button>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
            <div className="space-y-3">
              <div>
                <h2 className="text-base font-bold text-[var(--text-primary)]">Design & Print Assets</h2>
                <p className="text-sm text-[var(--text-secondary)]">Build trackable QR links for every asset in the design/print pack.</p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {DESIGN_PRINT_ASSETS.map((asset) => <AssetCard key={asset.key} asset={asset} onUse={chooseAsset} />)}
              </div>
            </div>

            <div className="space-y-5">
              <div className="card p-5">
                <div className="flex items-center gap-2">
                  <Image size={16} className="text-[var(--accent-color)]" />
                  <h2 className="text-base font-bold text-[var(--text-primary)]">Brand File Library</h2>
                </div>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">Canonical dashboard-served files for print and digital use.</p>
                <div className="mt-4 grid gap-2">
                  {BRAND_FILES.map((item) => <BrandFileRow key={item.path} item={item} />)}
                </div>
              </div>

              <div className="card p-5">
                <div className="flex items-center gap-2">
                  <Printer size={16} className="text-[var(--accent-color)]" />
                  <h2 className="text-base font-bold text-[var(--text-primary)]">Working Print Files</h2>
                </div>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">Hosted pages and reusable media that can be paired with QR campaign links.</p>
                <div className="mt-4 space-y-2">
                  {WORKING_PRINT_FILES.map((item) => (
                    <a key={item.path} href={item.preview} target="_blank" rel="noopener noreferrer" className="block rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-3 py-2.5 transition-colors hover:bg-[var(--bg-card-hover)]">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-[var(--text-primary)]">{item.name}</p>
                        <span className="rounded-md bg-[var(--bg-card-hover)] px-2 py-1 text-[10px] font-bold text-[var(--text-secondary)]">{item.type}</span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-[var(--text-tertiary)]">{item.path}</p>
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="grid gap-5 xl:grid-cols-2">
            <div className="card p-5">
              <div className="flex items-center gap-2">
                <QrCode size={16} className="text-[var(--accent-color)]" />
                <h2 className="text-base font-bold text-[var(--text-primary)]">Campaign Links</h2>
              </div>
              <div className="mt-4 space-y-2">
                {links.length === 0 ? (
                  <p className="text-sm text-[var(--text-secondary)]">No links yet. Create one in the QR builder.</p>
                ) : links.map(link => (
                  <button key={link.id} type="button" onClick={() => setSelectedLinkId(link.id)} className={`w-full rounded-lg border px-3 py-2.5 text-left transition-colors ${selectedLink?.id === link.id ? 'border-[var(--accent-color)] bg-[var(--bg-card-hover)]' : 'border-[var(--border-subtle)] bg-[var(--bg-primary)]'}`}>
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{link.name}</p>
                      <span className="rounded-full bg-[var(--bg-card-hover)] px-2 py-1 text-[10px] font-bold text-[var(--text-secondary)]">{link.clicks || 0} scans</span>
                    </div>
                    <p className="mt-0.5 truncate text-[11px] text-[var(--text-tertiary)]">{link.utmUrl}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="card p-5">
              <div className="flex items-center gap-2">
                <Star size={16} className="text-[var(--accent-color)]" />
                <h2 className="text-base font-bold text-[var(--text-primary)]">Referral Codes</h2>
              </div>
              <div className="mt-4 space-y-2">
                {referrals.length === 0 ? (
                  <p className="text-sm text-[var(--text-secondary)]">No referral codes yet. Create one above for a renter or local partner.</p>
                ) : referrals.map(referral => (
                  <div key={referral.id} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-[var(--text-primary)]">{referral.name}</p>
                        <p className="mt-0.5 text-xs text-[var(--text-secondary)]">{referral.offer}</p>
                      </div>
                      <button type="button" className="rounded-md bg-[var(--bg-card-hover)] px-2 py-1 font-mono text-xs font-bold text-[var(--accent-color)]" onClick={() => copyText(referral.code).then(() => flash('Referral code copied'))}>
                        {referral.code}
                      </button>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-[var(--text-secondary)]">
                      <div className="rounded-lg bg-[var(--bg-card)] p-2">Bookings: <strong>{referral.bookings || 0}</strong></div>
                      <div className="rounded-lg bg-[var(--bg-card)] p-2">Revenue: <strong>{money(referral.revenue)}</strong></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="grid gap-3 md:grid-cols-4">
            {[
              { title: 'Review Flywheel', icon: Star, text: 'Use completed-rental reviews as campaign proof and SMS follow-up fuel.' },
              { title: 'Partner Kits', icon: Users, text: 'Bundle QR assets for body shops, hotels, dealers, and service centers.' },
              { title: 'Landing Pages', icon: Sparkles, text: 'Next: dedicated rideshare, insurance replacement, and weekly rental pages.' },
              { title: 'Performance', icon: BarChart3, text: 'Manual attribution now; booking-source automation can come next.' },
            ].map(section => {
              const Icon = section.icon;
              return (
                <div key={section.title} className="rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
                  <Icon size={17} className="text-[var(--accent-color)]" />
                  <h3 className="mt-3 text-sm font-bold text-[var(--text-primary)]">{section.title}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">{section.text}</p>
                </div>
              );
            })}
          </section>
        </>
      )}
    </div>
  );
}
