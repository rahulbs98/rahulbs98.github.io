# Website Setup Guide

This guide explains how to run the site locally, update content, and deploy it.

## Prerequisites

- Node.js 16+ and npm

## Install

```bash
npm install
```

## Run Locally

```bash
npm start
```

Site runs at http://localhost:3000.

## Update Data

```bash
npm run pubs    # publications.json from publications.bib
npm run albums  # albums.json from albums.meta.json + images
npm run blog    # blog.json from the Substack RSS feed
npm run news    # news.json from publications and manual academic updates
npm run build   # regenerate all data files and validate the static site
npm test        # build, validate, and open a local preview
npm run validate # build and validate without starting a server
npm run publish -- "Describe your update"  # test, commit, and push to main
```

## Profile image focus

- To detect a good focal point for the profile photo, open `tools/detect_profile_face.html` in your browser and copy the `object-position: X% Y%` value.
- To apply the value to the site automatically, run:
```bash
node tools/apply_profile_focus.js "X% Y%"
```
- If you prefer automation via Node, `npm run detect-profile-face` will attempt to run a TensorFlow-based detector and patch `index.html` automatically (may need Node 18 on macOS to install native binaries).

## Deployment (GitHub Pages)

1. Push changes to main.
2. GitHub Settings -> Pages -> Deploy from a branch.
3. Select main and /(root).

## Project Structure

```
website_src/
├── index.html                 # Homepage
├── bio.html                   # Bio page
├── blog.html                  # Blog (Substack)
├── research.html              # Research page
├── links.html                 # Links
├── news.html                  # Security, privacy, and cryptography news
├── albums/
│   └── index.html             # Photo gallery
├── assets/
│   ├── css/
│   │   └── style.css          # Global styles
│   ├── js/
│   │   └── components.js      # Theme, footer, social links
│   ├── images/
│   │   ├── prof_pic.jpg        # Profile image
│   │   └── albums/             # Photo albums
│   └── data/
│       ├── publications.json   # Generated from BibTeX
│       ├── albums.meta.json    # Album metadata (source)
│       ├── albums.json         # Generated for gallery
│       ├── news.manual.json    # Manual academic updates
│       └── news.json           # Generated academic timeline
├── publications.bib           # DBLP BibTeX source
├── convertBib.js              # Generates publications.json
├── generateAlbums.js          # Generates albums.json
├── generateBlog.js            # Generates blog.json from Substack RSS
├── generateNews.js            # Generates news.json from RSS sources
├── CONFIG.md                  # Configuration guide
└── photomanager/              # Tauri photo manager app
```
