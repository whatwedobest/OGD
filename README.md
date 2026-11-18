# OGD — OpenGate Data website

Beta build of the new OpenGate Data site (including the Gateway Consolidators and Records pages), built from the approved v4 wireframes and Luis Herrera's content feedback of November 13, 2026.

## Pages

| Page | Path | Source |
| --- | --- | --- |
| Home | `/` | `build/pages/01-home.html` |
| Broker Program | `/broker-program/` | `02-broker-program.html` |
| Declined Lead Monetization | `/declined-lead-monetization/` | `03-declined-lead-monetization.html` |
| Gateway Consolidators | `/gateway-consolidators/` | `04-gateway-consolidators.html` |
| Records | `/records/` | `05-records.html` |
| How It Works | `/how-it-works/` | `06-how-it-works.html` |
| Submission Criteria | `/submission-criteria/` | `07-submission-criteria.html` |
| About | `/about/` | `08-about.html` |
| Contact | `/contact/` | `09-contact.html` |
| Submit a Deal | `/submit-a-deal/` | `10-submit-a-deal.html` |
| Resources | `/resources/` | `11-resources.html` |
| Privacy Policy | `/privacy-policy/` | `12-privacy-policy.html` |
| Terms & Conditions | `/terms/` | `13-terms.html` |

The v4 wireframe for Broker Program is kept at `wireframes/broker-program.html`.

## Editing and building

Plain HTML, CSS and JavaScript with no framework. Page bodies live in `build/pages/`; the shared header, footer, SEO tags and structured data live in `build/build.py`.

```
python3 build/build.py
```

The build writes each page to `<path>/index.html`, plus `sitemap.xml`, `robots.txt` and `llms.txt`. Links inside page files use `{{root}}` so the site works at any base path (GitHub Pages now, opengatedata.com later). Commit both the source and the built files.

- Styles: `assets/css/site.css` (Archivo; accent `#93CA3A`; deep green `#3E6B14` for accent words on light backgrounds)
- Behaviour: `assets/js/site.js` (menu, solution tabs, file upload, form validation)
- Form endpoints: `assets/js/config.js`

## Before launch

1. **Forms.** Set `brokerEndpoint` and `gatewayEndpoint` in `assets/js/config.js` once the secure intake service is live. Until then forms validate and show a beta notice; nothing is sent. Per Luis: statements go to private, encrypted storage; Monday receives the submission details plus a secure link (not attachments); broker submissions route to the Broker Form board and Gateway inquiries to the Gateway Form board, kept separate.
2. **Legal pages.** Paste the current Privacy Policy and Terms word for word into `12-privacy-policy.html` and `13-terms.html`, and have counsel review the Gateway disclosure.
3. **Resources.** The six approved launch articles are listed as "coming soon."
4. **Testimonials.** Left out until real broker quotes with permission are available.
5. **Go live.** In `build/build.py`, set `BETA = False` (removes the review ribbon and `noindex`), rebuild, and point opengatedata.com at the host.
