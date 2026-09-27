#!/bin/bash
# Tags a release; GitHub Actions then builds the Docker image and server02 pulls it.
#   ./scripts/release.sh 1.0.0
set -e

VERSION="$1"

if [ -z "$VERSION" ]; then
  echo "Usage: ./scripts/release.sh <version>"
  echo "Example: ./scripts/release.sh 1.0.0"
  exit 1
fi

if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-.+)?$ ]]; then
  echo "Error: version must be semver (e.g. 1.0.0 or 1.1.0-beta.1)"
  exit 1
fi

if [ -n "$(git status --porcelain)" ]; then
  echo "Error: working directory not clean. Commit or stash changes first."
  exit 1
fi

TAG="v${VERSION}"
BRANCH="$(git branch --show-current)"
if git rev-parse "$TAG" >/dev/null 2>&1; then
  echo "Error: tag $TAG already exists"
  exit 1
fi

# The image is built from the tag, so what gets released must pass first
echo "Checking lint, tests and build ..."
pnpm lint
pnpm test --run
pnpm build

echo "Releasing Clausage Manager $TAG"

node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.version = '$VERSION';
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
"

git add package.json
git commit -m "release: v${VERSION}"
git tag "$TAG"

# Load GH_TOKEN from .env if available (.env is git-ignored)
if [ -z "$GH_TOKEN" ] && [ -f .env ]; then
  source .env
fi

if [ -n "$GH_TOKEN" ]; then
  REMOTE="https://Flo0806:${GH_TOKEN}@github.com/Flo0806/clausage-manager.git"
  git push "$REMOTE" "$BRANCH"
  git push "$REMOTE" "$TAG"
else
  git push origin "$BRANCH"
  git push origin "$TAG"
fi

echo ""
echo "Done! GitHub Actions builds ghcr.io/flo0806/clausage-manager:${VERSION}; server02 picks it up within 10 minutes."
