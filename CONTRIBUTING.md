# Contributing

## Quick Start
```bash
pip install -r backend/requirements.txt
cd dashboard && npm install
```

## Running Tests
```bash
cd backend && python -m pytest tests/ -v
```

## Code Style
- Python: `ruff check .` (config in pyproject.toml)
- JSX: Prettier defaults (single quotes, no trailing commas)
- No TODO/FIXME in committed code

## PR Checklist
- [ ] Tests pass (`pytest`)
- [ ] Frontend builds (`npm run build`)
- [ ] No secret/credential leaks
- [ ] One logical change per commit
