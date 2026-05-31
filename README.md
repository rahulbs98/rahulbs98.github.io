# Rahul's Personal Website Source

This repository contains the source code for my personal website, hosted at https://rahulbs98.github.io and mirrored to https://rahulbs.me. It includes research content, a Substack-powered blog page, and photography albums with metadata.

## Quick Start

```bash
npm install
npm start
```

Local site runs at http://localhost:3000.

## Customize Your Site

Update these items for your own site:

1. Bio and research pages
   - Edit bio in bio.html
   - Edit research in research.html

2. Substack blog
   - Open blog.html
   - Update the Substack username in SubstackBlogManager

3. Social links and footer
   - Edit social links in assets/js/components.js

4. Profile image and CV
   - Replace assets/images/prof_pic.jpg
   - Replace assets/data/cv.pdf

Profile image automation
- Quick helper: `tools/detect_profile_face.html` — open in a browser to detect the primary face and get a recommended `object-position: X% Y%` value.
- Apply automatically: `node tools/apply_profile_focus.js "X% Y%"` will patch `index.html` to set the profile `object-position`.
- Automated detector (optional): `npm run detect-profile-face` runs a TensorFlow detector (may require Node 18). This is provided for convenience but the browser helper + apply script avoids native installs.

5. Publications
   - Update DBLP settings in convertBib.js
   - Run npm run pubs to regenerate assets/data/publications.json

## Albums and Photo Manager

Photos live under assets/images/albums/{album-name}/. Metadata lives in assets/data/albums.meta.json, with keys like:

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

After adding or editing albums, run:

```bash
npm run albums
```

This generates assets/data/albums.json used by the albums page.

### Photo Manager App (Recommended)

Use the desktop app in photomanager/ to create albums and update metadata:

```bash
cd photomanager
npm install
npm run dev
```

The app:
- Copies images into assets/images/albums/{normalized-album-name}/
- Appends metadata to assets/data/albums.meta.json

Then run npm run albums from website_src/.

See photomanager/README.md for detailed app setup.

## Scripts

- npm start: run locally
- npm run pubs: refresh publications
- npm run albums: rebuild albums.json
- npm run build: placeholder build hook

## Deployment (GitHub Pages)

1. Push changes to main.
2. GitHub Settings -> Pages -> Deploy from a branch.
3. Choose main and /(root).

## Documentation

- CONFIG.md: configuration reference
- SETUP.md: setup and structure
- photomanager/README.md: app usage

## License
The source code in this repository is licensed under the MIT License.
All written content and photographs are © Rahul and are not covered by the MIT License. They may not be reused without explicit permission. See [LICENSE](LICENSE) for details.

## Credits
If you use this code, please consider attributing this repository:
> [rahulbs98.github.io] by [rahulbs98] (https://github.com/rahulbs98/rahulbs98.github.io)

