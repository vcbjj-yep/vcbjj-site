name: Update Blog Previews

on:
  push:
    branches: [main]
    paths:
      - 'blog/**.html'

jobs:
  update-previews:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repo
        uses: actions/checkout@v4
        with:
          token: ${{ secrets.GITHUB_TOKEN }}

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Run update script
        run: node .github/scripts/update-blog-preview.js

      - name: Commit updated files
        run: |
          git config user.name  "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add index.html blog/index.html
          git diff --staged --quiet || git commit -m "chore: auto-update blog previews [skip ci]"
          git push
