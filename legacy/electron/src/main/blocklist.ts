const HOSTS = [
  'doubleclick.net',
  'googlesyndication.com',
  'googleadservices.com',
  'google-analytics.com',
  'googletagmanager.com',
  'googletagservices.com',
  'adservice.google.com',
  'pagead2.googlesyndication.com',
  'adnxs.com',
  'adsrvr.org',
  'rubiconproject.com',
  'pubmatic.com',
  'openx.net',
  'casalemedia.com',
  'criteo.com',
  'criteo.net',
  'taboola.com',
  'outbrain.com',
  'moatads.com',
  'scorecardresearch.com',
  'quantserve.com',
  'amazon-adsystem.com',
  'media.net',
  'sharethrough.com',
  'smartadserver.com',
  '3lift.com',
  'lijit.com',
  'bidswitch.net',
  'contextweb.com',
  'rlcdn.com',
  'bluekai.com',
  'exelator.com',
  'demdex.net',
  'omtrdc.net',
  'everesttech.net',
  'krxd.net',
  'ads.yahoo.com',
  'advertising.com',
  'adform.net',
  'adroll.com',
  'serving-sys.com',
  'flashtalking.com',
  'teads.tv',
  'mgid.com',
  'revcontent.com',
  'zedo.com',
  'adsafeprotected.com',
  'chartbeat.com',
  'hotjar.com',
  'fullstory.com',
  'mouseflow.com',
  'crazyegg.com',
  'segment.io',
  'segment.com',
  'mixpanel.com',
  'branch.io',
  'appsflyer.com',
  'adjust.com',
  'facebook.net',
  'connect.facebook.net',
  'ads.twitter.com',
  'ads.linkedin.com',
  'bat.bing.com',
  'ads.pinterest.com',
  'analytics.tiktok.com',
  'mc.yandex.ru',
  'ad.doubleclick.net',
  'securepubads.g.doubleclick.net',
  'tpc.googlesyndication.com',
];

const EXACT = new Set(HOSTS);

export function isAdUrl(raw: string, extra: string[] = []): boolean {
  let host = '';
  let path = '';
  try {
    const u = new URL(raw);
    host = u.hostname.toLowerCase();
    path = u.pathname.toLowerCase();
  } catch {
    return false;
  }
  if (matches(host, extra)) return true;
  const bits = host.split('.');
  for (let i = 0; i < bits.length - 1; i += 1) {
    if (EXACT.has(bits.slice(i).join('.'))) return true;
  }
  if (host.startsWith('ads.') || host.startsWith('adservice.') || host.includes('.ads.')) return true;
  if (path.includes('/pagead/') || path.includes('/adservice/')) return true;
  return false;
}

function matches(host: string, extra: string[]): boolean {
  return extra.some((h) => {
    const n = h.trim().toLowerCase().replace(/^\*\./, '');
    return !!n && (host === n || host.endsWith(`.${n}`));
  });
}
