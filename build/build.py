#!/usr/bin/env python3
"""Build the OpenGate Data static site.

Each page body lives in build/pages/<name>.html. Its first line is a JSON
comment with the page settings:

    <!--meta {"path": "broker-program/", "title": "...", "description": "...",
              "nav": "broker", "crumb": "Broker Program", "header": "solid"} -->

Inside a page, write links relative to the site root using {{root}}, e.g.
<a href="{{root}}gateway-consolidators/">. The build fills in the right
relative prefix so the site works at any base path (GitHub Pages, Vercel,
or the final opengatedata.com domain).

Run:  python3 build/build.py
Output: index.html and <path>/index.html files at the repository root,
plus sitemap.xml, robots.txt and llms.txt.
"""
import html
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PAGES = ROOT / "build" / "pages"

SITE = {
    "name": "OpenGate Data",
    "domain": "https://www.opengatedata.com/",
    "tagline": "Beyond Fundable. Beyond Conventional.",
    "working_tagline": "More Opportunities for Brokers. Better Financial Solutions for Businesses.",
    "email": "support@opengatedata.com",
    "phone": "(561) 223-1688",
    "phone_href": "+15612231688",
    "city": "Boca Raton",
    "region": "FL",
    "postal": "33431",
    "booking": "https://calendar.app.google/JTbyWT2rURonvT2TA",
    "linkedin": "https://www.linkedin.com/company/opengate-data/",
    "facebook": "https://www.facebook.com/profile.php?id=61584604533683",
    "x": "https://x.com/OpenGate_Data",
}

# Beta: every page carries noindex and a review ribbon until launch. Flip to False at launch.
BETA = True
ASSET_VERSION = "1"

NAV_SOLUTIONS = [
    ("declined", "declined-lead-monetization/", "Declined Lead Monetization", "Recover value from files lenders declined"),
    ("gateway", "gateway-consolidators/", "Gateway Consolidators", "A review path for stacked MCA merchants"),
    ("records", "records/", "Records", "UCC, MCA submission and responder data"),
]

ICONS = {
    "linkedin": '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9h4v12H3zM9 9h3.8v1.7h.05c.53-1 1.83-2.05 3.77-2.05 4.03 0 4.78 2.65 4.78 6.1V21h-4v-5.4c0-1.3-.02-2.95-1.8-2.95-1.8 0-2.07 1.4-2.07 2.86V21H9z"/></svg>',
    "facebook": '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13.5 21v-8h2.7l.4-3.1h-3.1V7.9c0-.9.25-1.5 1.55-1.5h1.65V3.6c-.3-.04-1.27-.12-2.4-.12-2.38 0-4 1.45-4 4.1v2.3H7.6V13h2.7v8z"/></svg>',
    "x": '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17.75 3h3.07l-6.7 7.66L22 21h-6.17l-4.83-6.32L5.47 21H2.4l7.17-8.2L2 3h6.33l4.37 5.78zm-1.08 16.17h1.7L7.4 4.74H5.58z"/></svg>',
}


def rel_prefix(path: str) -> str:
    depth = len([p for p in path.strip("/").split("/") if p])
    return "../" * depth if depth else ""


def header(meta, root):
    overlay = meta.get("header") == "overlay"
    cur = meta.get("nav", "")

    def cur_attr(key):
        return ' aria-current="page"' if cur == key else ""

    sol_links = "".join(
        f'<a href="{root}{p}"{cur_attr(k)}><strong>{t}</strong><span>{d}</span></a>' for k, p, t, d in NAV_SOLUTIONS
    )
    sol_current = ' aria-current="page"' if cur in {k for k, *_ in NAV_SOLUTIONS} else ""
    mobile_sol = "".join(f'<a href="{root}{p}">{t}</a>' for _, p, t, _ in NAV_SOLUTIONS)
    cls = "site-header site-header--overlay" if overlay else "site-header"
    return f"""<header class="{cls}">
<div class="wrap header-inner">
<nav class="nav nav--left" aria-label="Main">
<a href="{root}broker-program/"{cur_attr('broker')}>Broker Program</a>
<div class="dropdown"><button type="button" aria-expanded="false" aria-haspopup="true"{sol_current}>Solutions</button><div class="dropdown-menu">{sol_links}</div></div>
<a href="{root}how-it-works/"{cur_attr('how')}>How It Works</a>
<a href="{root}resources/"{cur_attr('resources')}>Resources</a>
<a href="{root}about/"{cur_attr('about')}>About</a>
</nav>
<a class="brand" href="{root or './'}" aria-label="OpenGate Data home"><img src="{root}assets/img/ogd-mark.png" alt="OpenGate Data" width="59" height="48"></a>
<div class="nav nav--right">
<a class="nav-secondary" href="{root}contact/"{cur_attr('contact')}>Contact</a>
<a class="btn btn--lime" href="{root}submit-a-deal/">Submit a Deal</a>
<button class="menu-toggle" type="button" aria-expanded="false" aria-controls="mobile-menu"><span></span><span class="sr-only">Menu</span></button>
</div>
</div>
<div class="mobile-menu" id="mobile-menu">
<a href="{root}broker-program/">Broker Program</a>
<p class="mm-label">Solutions</p>
{mobile_sol}
<a href="{root}how-it-works/">How It Works</a>
<a href="{root}submission-criteria/">Submission Criteria</a>
<a href="{root}resources/">Resources</a>
<a href="{root}about/">About</a>
<a href="{root}contact/">Contact</a>
</div>
</header>"""


def footer(root):
    s = SITE
    social = "".join(
        f'<a href="{s[k]}" rel="noopener" target="_blank" aria-label="OpenGate Data on {label}">{ICONS[k]}</a>'
        for k, label in (("linkedin", "LinkedIn"), ("facebook", "Facebook"), ("x", "X"))
    )
    return f"""<footer class="site-footer">
<div class="wrap footer-top">
<div class="footer-brand"><img src="{root}assets/img/ogd-mark.png" alt="OpenGate Data" width="59" height="48"><p>{s['tagline']}<br>{s['working_tagline']}</p></div>
<div class="footer-col"><strong>Partner program</strong><a href="{root}broker-program/">Broker Program</a><a href="{root}how-it-works/">How It Works</a><a href="{root}submission-criteria/">Submission Criteria</a><a href="{root}submit-a-deal/">Submit a Deal</a></div>
<div class="footer-col"><strong>Solutions</strong><a href="{root}declined-lead-monetization/">Declined Lead Monetization</a><a href="{root}gateway-consolidators/">Gateway Consolidators</a><a href="{root}records/">Records</a></div>
<div class="footer-col"><strong>Company</strong><a href="{root}about/">About</a><a href="{root}resources/">Resources</a><a href="{root}contact/">Contact</a><a href="{s['booking']}" rel="noopener" target="_blank">Book a Call</a></div>
<div class="footer-col"><strong>Contact</strong><span>Corporate Offices<br>{s['city']}, {s['region']} {s['postal']}</span><a href="tel:{s['phone_href']}">{s['phone']}</a><a href="mailto:{s['email']}">{s['email']}</a></div>
</div>
<div class="wrap footer-bottom"><span>© 2026 OpenGate Data. All rights reserved. · <a href="{root}privacy-policy/">Privacy Policy</a> · <a href="{root}terms/">Terms &amp; Conditions</a></span><div class="social">{social}</div></div>
<div class="wrap footer-disclosure">OpenGate Data works with brokers, ISOs and referral partners. Gateway Consolidators is a service brand of OpenGate Data; it is not a lender and does not make loans. Submitting a file is not an approval, and no outcome, payment reduction, timeline or commission is guaranteed. Information on this site is not legal, tax or financial advice.</div>
</footer>"""


def schema(meta, faqs):
    s = SITE
    url = s["domain"] + meta["path"]
    org = {
        "@type": "Organization",
        "@id": s["domain"] + "#org",
        "name": s["name"],
        "url": s["domain"],
        "logo": s["domain"] + "assets/img/ogd-mark.png",
        "slogan": s["tagline"],
        "email": s["email"],
        "telephone": "+1-561-223-1688",
        "address": {"@type": "PostalAddress", "addressLocality": s["city"], "addressRegion": s["region"], "postalCode": s["postal"], "addressCountry": "US"},
        "areaServed": "US",
        "sameAs": [s["linkedin"], s["facebook"], s["x"]],
    }
    graph = [org, {"@type": "WebPage", "@id": url, "url": url, "name": meta["title"], "description": meta["description"], "isPartOf": {"@type": "WebSite", "name": s["name"], "url": s["domain"]}, "publisher": {"@id": s["domain"] + "#org"}}]
    if meta.get("service"):
        graph.append({"@type": "Service", "name": meta["service"], "provider": {"@id": s["domain"] + "#org"}, "areaServed": "US", "url": url, "description": meta["description"]})
    if meta["path"]:
        graph.append({"@type": "BreadcrumbList", "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Home", "item": s["domain"]},
            {"@type": "ListItem", "position": 2, "name": meta.get("crumb", meta["title"]), "item": url},
        ]})
    if faqs:
        graph.append({"@type": "FAQPage", "mainEntity": [
            {"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in faqs
        ]})
    return json.dumps({"@context": "https://schema.org", "@graph": graph}, ensure_ascii=False, indent=1)


def extract_faqs(body):
    out = []
    for q, a in re.findall(r'<details[^>]*data-faq[^>]*>\s*<summary>(.*?)</summary>\s*<div class="faq-a">(.*?)</div>', body, re.S):
        clean = lambda t: html.unescape(re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", t))).strip()
        out.append((clean(q), clean(a)))
    return out


def render(src: Path):
    raw = src.read_text()
    m = re.match(r"<!--meta (\{.*?\}) -->\n", raw, re.S)
    if not m:
        raise SystemExit(f"{src.name}: missing <!--meta {{...}} --> line")
    meta = json.loads(m.group(1))
    body = raw[m.end():]
    root = rel_prefix(meta["path"])
    body = body.replace("{{root}}", root).replace("{{booking}}", SITE["booking"])
    if meta["path"] and meta.get("crumb"):
        crumb = f'<nav class="breadcrumb" aria-label="Breadcrumb"><a href="{root or "./"}">Home</a> / <span aria-current="page">{meta["crumb"]}</span></nav>'
        body = body.replace("{{breadcrumb}}", crumb)
    faqs = extract_faqs(body)
    canonical = SITE["domain"] + meta["path"]
    robots = '<meta name="robots" content="noindex, nofollow">' if BETA else '<meta name="robots" content="index, follow, max-image-preview:large">'
    ribbon = '<div class="beta-ribbon">Beta site for client review. Copy and forms are not final.</div>' if BETA else ""
    og_img = SITE["domain"] + meta.get("image", "assets/img/ogd-hero-poster.jpg")
    page = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{html.escape(meta['title'])}</title>
<meta name="description" content="{html.escape(meta['description'])}">
{robots}
<link rel="canonical" href="{canonical}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="OpenGate Data">
<meta property="og:title" content="{html.escape(meta['title'])}">
<meta property="og:description" content="{html.escape(meta['description'])}">
<meta property="og:url" content="{canonical}">
<meta property="og:image" content="{og_img}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#93CA3A">
<link rel="icon" href="{root}assets/img/favicon.png" type="image/png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,300..900&amp;display=swap" rel="stylesheet">
<link rel="stylesheet" href="{root}assets/css/site.css?v={ASSET_VERSION}">
<script type="application/ld+json">
{schema(meta, faqs)}
</script>
</head>
<body>
<a class="skip-link" href="#main">Skip to content</a>
{ribbon}
{header(meta, root)}
<main id="main">
{body.strip()}
</main>
{footer(root)}
<script src="{root}assets/js/config.js?v={ASSET_VERSION}"></script>
<script src="{root}assets/js/site.js?v={ASSET_VERSION}" defer></script>
</body>
</html>
"""
    out = ROOT / meta["path"] / "index.html" if meta["path"] else ROOT / "index.html"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(page)
    left = re.findall(r"\{\{[a-z]+\}\}", page)
    if left:
        raise SystemExit(f"{src.name}: unreplaced tokens {left}")
    return meta


def main():
    metas = [render(p) for p in sorted(PAGES.glob("*.html"))]
    urls = "\n".join(f"  <url><loc>{SITE['domain']}{m['path']}</loc></url>" for m in metas)
    (ROOT / "sitemap.xml").write_text(f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n{urls}\n</urlset>\n')
    (ROOT / "robots.txt").write_text(f"User-agent: *\nAllow: /\n\nSitemap: {SITE['domain']}sitemap.xml\n")
    lines = [f"# {SITE['name']}", "", f"> {SITE['name']} helps MCA brokers and ISOs find new opportunities in declined files, stacked MCA situations and other hard-to-place commercial funding submissions. {SITE['tagline']}", "", "## Pages", ""]
    lines += [f"- [{m.get('crumb', 'Home')}]({SITE['domain']}{m['path']}): {m['description']}" for m in metas]
    lines += ["", "## Contact", "", f"- {SITE['city']}, {SITE['region']} {SITE['postal']}", f"- {SITE['phone']}", f"- {SITE['email']}", ""]
    (ROOT / "llms.txt").write_text("\n".join(lines))
    print(f"Built {len(metas)} pages.")


if __name__ == "__main__":
    main()
