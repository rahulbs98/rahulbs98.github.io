#!/usr/bin/env bash
set -euo pipefail

commit_message="${1:-Update website}"

echo "Running site tests..."
npm run validate

echo "Staging changes..."
git add -A

if git diff --cached --quiet; then
  echo "No changes to publish."
  exit 0
fi

echo "Creating commit: ${commit_message}"
git commit -m "$commit_message"

echo "Pushing to origin/main..."
git push origin main
echo "Published successfully."