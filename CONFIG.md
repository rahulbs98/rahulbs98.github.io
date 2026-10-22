# Website Configuration Guide

## Substack Blog Integration

To connect your Substack blog to the website, you need to update the blog page with your Substack username:

### Steps:

1. **Open `blog.html`**
2. **Find this line** (near the bottom):
  ```javascript
  const blogManager = new SubstackBlogManager('longconversations');
  ```

3. **Replace `'rahulsatish98'`** with your Substack subdomain
  - Example: If your Substack URL is `https://mycryptoblog.substack.com`, use `'mycryptoblog'`

### How It Works:

- `npm run blog` fetches the latest 12 published posts from both Substack RSS feeds into `assets/data/blog.json`
- The blog page reads the local snapshot, avoiding browser-side API/CORS failures on GitHub Pages
- `Long Conversations` is the personal/politics section; `Rahul Satish` is the original technical/collaborative section
- Posts are displayed with title, date, category, excerpt, and a link to read on the relevant Substack
- If a post has a cover image, it's displayed; otherwise, it shows a gradient background
- New posts will automatically appear when you publish them on Substack

### Troubleshooting:

- **Posts not showing?** Make sure they're published (not drafts) on Substack
- **Wrong subdomain?** Double-check your Substack URL and use only the subdomain part
- **Styling looks odd?** Clear your browser cache (Ctrl+Shift+Delete or Cmd+Shift+Delete)

---

## Theme Configuration

The website automatically supports light and dark modes:

- **Theme Toggle**: Click the moon/sun icon in the top-right corner
- **Auto-Detection**: If no preference is saved, uses your system's theme preference
- **Persistent**: Your theme choice is saved in your browser

To change colors, edit the CSS variables in `assets/css/style.css`:

```css
:root {
  --color-accent: #9CA3AF;          /* Dark theme accent */
  --color-accent-secondary: #6B7280;
  /* ... other variables ... */
}

[data-theme="light"] {
  --color-accent: #2563EB;          /* Light theme link accent */
  --color-accent-secondary: #1D4ED8;
}
```

---

## Social Links Configuration

Edit social links in `assets/js/components.js`:

```javascript
const SOCIAL_LINKS = [
  { icon: 'github', url: 'https://github.com/rahulbs98', label: 'GitHub' },
  { icon: 'linkedin', url: 'https://www.linkedin.com/in/rahulbs98', label: 'LinkedIn' },
  { icon: 'email', url: 'mailto:rahs@itu.dk', label: 'Email' },
  // ... update URLs to your actual profiles
];
```

---

## Publications from DBLP and Google Scholar

Publications automatically load from `assets/data/publications.json`, generated as the deduplicated union of DBLP BibTeX and the configured Google Scholar profile.

To update publications:

```bash
npm run pubs
```

This fetches the latest DBLP BibTeX, reads the configured Google Scholar profile, and regenerates the combined JSON file. If DBLP is temporarily blocked, the existing generated data is retained.

---

## Albums (Auto-Generated)

Images are read from `assets/images/albums/` and converted into `assets/data/albums.json`.

Metadata lives in `assets/data/albums.meta.json` using the album folder and filename as the key:

```json
{
  "tokyo-2024/photo1.jpg": {
    "title": "Shibuya Crossing",
    "tags": ["travel", "architecture"],
    "location": "Tokyo, Japan",
    "date": "2024-05-15",
    "album": "tokyo-2024"
  }
}
```

Regenerate `albums.json` with:

```bash
npm run albums
```

## Academic News

`news.html` is a personal academic timeline, not an external news reader. ePrint announcements and accepted conference publications are generated from `assets/data/publications.json`. Add talks, awards, visits, and other updates to `assets/data/news.manual.json`:

```json
[
  {
    "date": "2026-10-22",
    "category": "Talk",
    "title": "Talk title",
    "summary": "A short description of the talk or academic update.",
    "url": "https://example.com/event"
  }
]
```

Regenerate the timeline with:

```bash
npm run news
```

---

## Quick File Reference

| File | Purpose |
|------|---------|
| `index.html` | Homepage |
| `bio.html` | Bio page |
| `blog.html` | Blog (Substack integration) |
| `research.html` | Research page |
| `links.html` | Interesting links |
| `albums/index.html` | Photo gallery |
| `assets/css/style.css` | Styling (theme colors, layouts) |
| `assets/js/components.js` | Theme toggle, social links, footer |
| `publications.bib` | DBLP-fetched BibTeX file |
| `convertBib.js` | Fetches DBLP BibTeX + generates JSON |

