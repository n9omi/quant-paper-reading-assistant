# Quant Paper Analyzer and Reading Assistant

A RAG-powered research AI that helps you deeply understand quant finance, applied math, and ML academic papers.

Upload PDFs → get intuitive breakdowns of the math and economics → build a searchable knowledge base → ask questions across your entire library.

## Features

- **6-tab analysis** for every paper: Deep Dive, Theory, Methods, Findings, Replication Plan, Improvements
- **Three-depth explanations**: Simple (ELI5) → Undergraduate → Rigorous for every concept
- **Multi-paper knowledge base**: upload multiple papers and ask cross-paper questions
- **Per-paper AI Q&A**: ask follow-up questions about any paper in your library
- **Replication plans**: phased roadmaps with Python libraries, difficulty ratings, and GitHub repo blueprints

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- An [Anthropic API key](https://console.anthropic.com/)

> **Note**: When running inside Claude.ai as an artifact, no API key is needed — it's handled automatically. The API key is only required when you run this locally as a standalone app.

### Local Development

```bash
git clone https://github.com/YOUR_USERNAME/paper-analyzer.git
cd paper-analyzer
npm install
npm run dev
```

Opens at `http://localhost:3000`. Upload any academic PDF to test.

### Deploy to Vercel (free)

```bash
npm install -g vercel
vercel
```

Follow the prompts. Your app will be live at `https://paper-analyzer-xxx.vercel.app`.

### Deploy to GitHub Pages

```bash
npm run build
```

Then push the `dist/` folder, or use the GitHub Actions workflow (see below).

## How It Works

1. You upload a PDF
2. The file is base64-encoded and sent to Claude's API with a structured analysis prompt
3. Claude returns a ~8,000 token JSON object with theory, math/econ foundations at 3 depths, methodology, findings, replication plan, and improvement ideas
4. The analysis is stored in an in-memory knowledge base
5. You explore it across 6 tabs, toggle depth levels, and ask follow-up questions

## Project Structure

```
paper-analyzer/
├── src/
│   ├── App.jsx          # Main application
│   └── main.jsx         # React entry point
├── index.html           # HTML shell
├── package.json         # Dependencies
├── vite.config.js       # Build config
└── .gitignore
```

## Testing Checklist

After deploying, verify each feature works:

- [ ] Upload a PDF → analysis completes without error
- [ ] Deep Dive tab: depth toggle switches between Simple/Undergrad/Rigorous
- [ ] Deep Dive tab: concept cards expand/collapse
- [ ] Theory tab: summary, key concepts, and equations render
- [ ] Methods tab: data sources, models, and pipeline render
- [ ] Findings tab: findings, implications, limitations render
- [ ] Replicate tab: prerequisites, timeline, phases, repo blueprint render
- [ ] Improve tab: improvement cards with ratings render
- [ ] "Ask AI about this paper" button opens per-paper chat
- [ ] Chat responds with relevant answers
- [ ] Upload a second paper → appears in sidebar
- [ ] Back to chat → cross-paper questions work
- [ ] Sidebar collapse/expand works
- [ ] Remove a paper from sidebar
- [ ] Error handling: upload a non-PDF → no crash

## Built With

- React 18 + Vite 5
- Anthropic Claude API (Sonnet)
- DM Sans + JetBrains Mono typography

## License

MIT
