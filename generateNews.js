const fs = require('fs');

const OUTPUT_PATH = 'assets/data/news.json';
const MANUAL_PATH = 'assets/data/news.manual.json';
const PUBLICATIONS_PATH = 'assets/data/publications.json';

function clean(value) {
  return String(value).replace(/[{}]/g, '').replace(/\s+/g, ' ').trim();
}

function publicationDate(tags) {
  if (tags.timestamp) {
    const timestamp = new Date(tags.timestamp);
    if (!Number.isNaN(timestamp.getTime())) return timestamp.toISOString();
  }
  return tags.year || '';
}

function publicationNews() {
  if (!fs.existsSync(PUBLICATIONS_PATH)) return [];

  const publications = JSON.parse(fs.readFileSync(PUBLICATIONS_PATH, 'utf8'));
  const seenEprints = new Set();
  return publications.flatMap(publication => {
    const tags = publication.entryTags || {};
    const year = tags.year || '';
    const date = publicationDate(tags);
    const title = clean(tags.title || 'Untitled publication');
    const venue = clean(publication.entryType === 'inproceedings'
      ? (tags.booktitle || tags.journal || '')
      : (tags.journal || tags.booktitle || ''));
    const url = tags.url ? clean(tags.url) : '';
    if (!url) return [];

    if (/eprint|iacr.*eprint/i.test(venue)) {
      const eprintKey = title.toLowerCase();
      if (seenEprints.has(eprintKey)) return [];
      seenEprints.add(eprintKey);
      return [{
        id: `eprint-${publication.citationKey}`,
        title: `New work on "${title}" is now on ePrint`,
        summary: `${clean(tags.author || 'Research collaborators')}${year ? ` · ${year}` : ''}`,
        category: 'ePrint',
        date,
        url,
        source: 'Research'
      }];
    }

    if (publication.entryType === 'inproceedings' || tags.booktitle) {
      const locationMatch = venue.match(/,\s*([^,]+(?:,\s*[^,]+){1,2}),\s*(?:January|February|March|April|May|June|July|August|September|October|November|December)/i);
      const location = locationMatch ? locationMatch[1] : '';
      const conference = tags.conferenceShortName || (locationMatch ? venue.slice(0, venue.indexOf(locationMatch[0])).replace(/,\s*$/, '') : venue);
      const updates = [{
        id: `acceptance-${publication.citationKey}`,
        title: `My work on "${title}" was accepted at ${conference}`,
        summary: `${location || 'Conference details to be added'}${year ? ` · ${year}` : ''}`,
        category: 'Publication',
        date,
        url,
        source: 'Research'
      }];
      if (tags.eprintUrl) {
        updates.push({
          id: `eprint-${publication.citationKey}`,
          title: `New work on "${title}" is now on ePrint`,
          summary: `${clean(tags.author || 'Research collaborators')}${year ? ` · ${year}` : ''}`,
          category: 'ePrint',
          date,
          url: clean(tags.eprintUrl),
          source: 'Research'
        });
      }
      return updates;
    }

    return [];
  });
}

function manualNews() {
  if (!fs.existsSync(MANUAL_PATH)) return [];
  return JSON.parse(fs.readFileSync(MANUAL_PATH, 'utf8')).map((item, index) => ({
    id: item.id || `manual-${index + 1}`,
    title: item.title,
    summary: item.summary || '',
    abstract: item.abstract || '',
    category: item.category || 'Academic life',
    date: item.date || '',
    url: item.url || '',
    videoUrl: item.videoUrl || '',
    source: item.source || 'Rahul Satish'
  })).filter(item => item.title);
}

function run() {
  const items = [...manualNews(), ...publicationNews()]
    .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify({
    description: 'Academic news and updates from Rahul Satish',
    items
  }, null, 2));
  console.log(`Generated ${OUTPUT_PATH} with ${items.length} academic updates.`);
}

run();
