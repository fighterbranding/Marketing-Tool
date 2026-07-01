# Pushing this project to your own GitHub repo

I can't create a GitHub repository or push code on your behalf — that requires your own GitHub login. Here's how to do it yourself once you've downloaded these files.

## 1. Create the repo on GitHub

Go to github.com → New repository → name it (e.g. `meta-marketing-platform`) → choose private or public → **do not** initialize with a README, .gitignore, or license (you already have these locally, and it avoids a merge conflict on first push).

## 2. Push your local files

After downloading and unzipping the files I've given you, open a terminal in that folder:

```bash
cd meta-marketing-platform
git init                                    # if not already a git repo
git add .
git commit -m "Initial blueprint and docs"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/meta-marketing-platform.git
git push -u origin main
```

Replace `YOUR_USERNAME` with your actual GitHub username.

## 3. Authentication

If `git push` asks for a password and rejects it, GitHub no longer accepts account passwords for git operations. Use one of:

- **Personal access token** — GitHub Settings → Developer settings → Personal access tokens → generate one, use it as the password when prompted
- **GitHub CLI** — `gh auth login`, then push normally; it handles auth for you
- **SSH key** — set one up under Settings → SSH keys, then use the `git@github.com:...` remote URL instead of `https://`

## 4. Protect your secrets

Before pushing, double check `.env` is in `.gitignore` (it already is in this scaffold) and that you never commit real Meta App credentials, the token encryption key, or database URLs. Only `.env.example` (with blank values) should be committed.

## 5. Set up GitHub Actions (optional, recommended once code exists)

Once you've scaffolded the actual NestJS/Next.js apps into `backend/` and `frontend/`, add a basic CI workflow:

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: cd backend && npm ci && npm run lint && npm run test
```

## 6. Branch protection

Once you have collaborators, go to repo Settings → Branches → add a protection rule on `main` requiring pull request review before merge — worth doing before you have a second person pushing code, not after something breaks production.
