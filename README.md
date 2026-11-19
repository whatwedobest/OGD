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

## Secure form intake (Vercel)

The forms post to three Vercel functions in `api/`:

| Route | Job |
| --- | --- |
| `POST /api/upload` | Issues 10-minute upload passes so the browser sends PDF statements straight to a **private** Vercel Blob store (PDF only, 25 MB max, under `statements/`). |
| `POST /api/submit` | Validates the form, confirms the files exist, and creates an item on the right monday.com board with the details and **signed, expiring links** to the statements as its first update. No attachments go to monday. |
| `GET /api/file` | Streams a statement only for a valid, unexpired signed link. |

Spam protection: hidden honeypot field, same-site origin check, PDF/size limits. Tests: `npm test`.

### Environment variables (set in Vercel, never in this repo)

| Variable | Value |
| --- | --- |
| `MONDAY_API_TOKEN` | monday.com API token with access to both boards |
| `MONDAY_BROKER_BOARD_ID` | Board for broker submissions |
| `MONDAY_GATEWAY_BOARD_ID` | Board for Gateway review requests |
| `MONDAY_BROKER_GROUP_ID`, `MONDAY_GATEWAY_GROUP_ID` | Optional group to drop new items into |
| `MONDAY_BROKER_COLUMNS`, `MONDAY_GATEWAY_COLUMNS` | Optional JSON mapping form fields to board columns, e.g. `{"broker_email":{"id":"email_mkx1","type":"email"}}` |
| `BLOB_READ_WRITE_TOKEN` | Added automatically when a **private** Blob store is connected to the project |
| `FILE_LINK_SECRET` | Long random string used to sign file links |
| `FILE_LINK_DAYS` | How long statement links stay valid (default 30) |
| `SITE_URL` | `https://www.opengatedata.com` (or the preview URL while testing) |
| `ALLOWED_ORIGINS` | Comma-separated site origins allowed to submit (defaults to opengatedata.com) |

Then set `intakeEnabled: true` in `assets/js/config.js`. Leave it `false` anywhere the `/api` functions don't run (GitHub Pages).

`vercel.json` holds redirects from the old Squarespace URLs and security headers.

## Before launch

1. **Hosting and forms.** Create the Vercel project from this repo, connect a private Blob store, set the variables above, enable intake, and run a test submission end to end.
2. **Legal pages.** Paste the current Privacy Policy and Terms word for word into `12-privacy-policy.html` and `13-terms.html`, and have counsel review the Gateway disclosure.
3. **Resources.** The six approved launch articles are listed as "coming soon."
4. **Testimonials.** Left out until real broker quotes with permission are available.
5. **Go live.** In `build/build.py`, set `BETA = False`, rebuild, add analytics, and point opengatedata.com at Vercel (keep the existing email/MX records).
