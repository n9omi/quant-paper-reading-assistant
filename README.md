# Quant Paper Reader

Drop in a technical paper (quant finance, economics, applied math, statistics, ML) and get:

- **Brief** — a one-line TL;DR, what the paper does, findings, practical implications, limits, and the story of the paper
- **Concepts** — every math and applied concept explained at three levels (Simple / Undergrad / Rigorous), with a mental model, a common pitfall, the Python tool you'd use, and a suggested study order
- **Equations** — the key equations rendered as real math, with each symbol explained in plain English
- **Method** — data, models, and the pipeline from data to results
- **Replicate** — a phased plan, a suggested repo layout, and a button that writes a runnable Python starter script (simulated data, public market data via yfinance, or your own CSV)
- **Extend** — improvement ideas rated by impact, difficulty and portfolio value
- **Ask** — questions about one paper or your whole library

**Live app:** https://n9omi.github.io/quant-paper-reading-assistant/

## Two ways to use it

| | Inside Claude | GitHub Pages / local |
|---|---|---|
| How | Open the published Claude artifact | Open the link above, or `index.html` |
| Key | None — uses your Claude account | Your own Anthropic API key, entered once |
| Where the key lives | — | Only in your browser's local storage; sent only to Anthropic |
| Paper input | PDF upload, pasted text | PDF upload, pasted text, **paper link or arXiv ID** |
| How Claude reads it | Extracted text (long papers are shortened in the middle to fit) | The full PDF, with prompt caching |

Get an API key at https://console.anthropic.com/settings/keys. A typical paper costs a few cents.

## How it works

It is one self-contained HTML file with no build step and no server.

1. **pdf.js** extracts the text in your browser; the reference list is dropped.
2. Claude is asked for the analysis in three smaller JSON parts (brief, concepts, plan). The brief comes first so you can start reading while the rest is written. Each part can be retried on its own.
3. Answers are parsed defensively (code fences, stray text, and un-escaped LaTeX backslashes are repaired).
4. **MathJax** renders the equations.
5. Your library is saved in your browser, so it survives a reload.

## Run it locally

```bash
git clone https://github.com/n9omi/quant-paper-reading-assistant.git
cd quant-paper-reading-assistant
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Limits

- Scanned PDFs without a text layer can't be read. Paste the text instead.
- Equations are reconstructed by the model from the PDF. Check them against the paper before you build on them.
- Paper links only work in the GitHub Pages version (Anthropic fetches the PDF); inside Claude, upload the file.

## Tested

Checked in headless Chromium against three real papers (Kalman 1960, a self-similarity survey, Mallat's *Understanding Deep Convolutional Networks*): text extraction, prompt size limits, all seven tabs, math rendering, streaming, the starter-code writer, library-wide questions, rate-limit / declined-access / malformed-answer / stop handling, persistence across reloads, API headers and prompt caching, arXiv link handling, dark mode, and phone width.

## License

MIT
