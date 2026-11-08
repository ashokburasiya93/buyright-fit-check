# BuyRight: "Will this work for me?"

A personal, cited fit check for product pages (concept for Amazon.in). Shoppers answer 2 to 5 quick questions; written rules give a verdict (Works / Works with a caveat / Likely won't work / Need more info); an AI model explains it with citations to the listing and to reviews from owners in a similar situation, and suggests same-category products that fit.

> All data is synthetic, made up for an AI PM course project. Not affiliated with any retailer.

- **Live app:** _pending deploy_ (no sign-in)
- **Miro opportunity board:** _pending_. Import `deliverables/2. AI Opportunity Mapping - BuyRight (Miro Import).csv` into Miro to rebuild it.

## Deliverables in this repo

| # | Deliverable | File |
|---|---|---|
| 1 | Problem discovery and user research | `deliverables/1. Problem Discovery and User Research - BuyRight.xlsx` |
| 2 | AI opportunity map | `deliverables/2. AI Opportunity Mapping - BuyRight.xlsx` (+ Miro import CSV) |
| 3 | AI PRD (with North Star and metrics) | `deliverables/3. AI PRD - BuyRight.docx` |
| 4 | Cost estimation | `deliverables/4. Cost Estimation - BuyRight.xlsx` |
| 5 | Working prototype + README | [`prototype/`](prototype/README.md) |
| 6 | Presentation | `deliverables/6. Presentation - BuyRight.pptx` |

The demo video script and client meeting prep are kept out of the repo, as the brief asks.

## Results at a glance (8 Nov 2026)

- Verdicts match hand labels: 41/41 dev, 18/18 held-out.
- Every safety gate at 100%: a failed check never shows as "works" (3,000 random profiles), unsafe/off-topic/injection questions declined before any model call, fact check catches invented numbers, fake citations, pressure and contradictions.
- Live models (Groq gpt-oss-120b, fallbacks gpt-oss-20b and OpenRouter Gemma): explanations grounded 41/41 dev and 17/18 held-out (the miss was blocked and replaced); Q&A right facts 18/19 dev, 9/9 held-out.
- Cost: about $0.0003 per explanation (about 950 tokens in, 205 out).

See [`prototype/README.md`](prototype/README.md) to run it locally and for the full eval tables.
