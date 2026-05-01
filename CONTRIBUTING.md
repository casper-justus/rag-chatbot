# Contributing

Thank you for your interest in contributing! Contributions are welcome in the form of bug reports, retrieval improvements, new LLM integrations, and documentation fixes.

## Getting Started

1. **Fork** the repository and create a new branch from `main`:
   ```bash
   git checkout -b feat/your-feature-name
   ```
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Copy `.env.example` to `.env` and add your Gemini API key and Qdrant config.
4. Open a **Pull Request** against `main` with a clear description of what changed and why.

## What You Can Contribute

- 🤖 **New LLM integrations** — support for OpenAI, Ollama, Mistral, or other providers
- 🔍 **Retrieval improvements** — better chunking strategies, re-ranking, hybrid search
- 🧪 **Tests** — unit tests for retrieval pipelines and response generation
- 📚 **Documentation** — architecture diagrams, usage examples, prompt engineering notes
- 🐛 **Bug fixes** — vector DB connection issues, context window handling, response formatting

## Pull Request Guidelines

- Keep PRs focused — one change per PR
- Use clear commit messages (e.g. `feat: add Ollama provider support`)
- Never commit API keys or `.env` files

## Reporting Issues

When reporting a bug, please include:
- The query or input that triggered the issue
- The error message or unexpected output
- Your Python version and relevant package versions

## Code of Conduct

Be respectful and constructive. Everyone is welcome regardless of experience level.
