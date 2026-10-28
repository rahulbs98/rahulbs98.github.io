const fs = require('fs');
const https = require('https');

const OUTPUT_PATH = 'assets/data/blog.json';
const FEEDS = {
  original: {
    title: 'Rahul Satish',
    description: 'Technical writing and a shared space for collaborators.',
    feedUrl: 'https://rahulsatish98.substack.com/feed',
    publicationUrl: 'https://rahulsatish98.substack.com',
    publishUrl: 'https://rahulsatish98.substack.com/publish'
  },
  personal: {
    title: 'Long Conversations',
    description: 'Personal writing, politics, and longer reflections.',
    feedUrl: 'https://longconversations.substack.com/feed',
    publicationUrl: 'https://longconversations.substack.com',
    publishUrl: 'https://longconversations.substack.com/publish'
  }
};

function fetchText(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, {
      family: 4,
      headers: { 'User-Agent': 'rahulbs98.github.io build' }
    }, response => {
      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error(`Substack feed fetch failed: ${response.statusCode}`));
        return;
      }

      let body = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { body += chunk; });
      response.on('end', () => resolve(body));
    });

    request.setTimeout(15_000, () => {
      request.destroy(new Error('Substack feed fetch timed out'));
    });
    request.on('error', reject);
  });
}

function decodeEntities(value = '') {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

function field(item, name) {
  const match = item.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'));
  return decodeEntities(match ? match[1] : '');
}

function parseItems(xml) {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)]
    .map(match => {
      const item = match[1];
      const title = field(item, 'title');
      const url = field(item, 'link');
      const date = field(item, 'pubDate');
      const description = field(item, 'description');
      const image = (item.match(/<enclosure[^>]+url="([^"]+)"/i) || [])[1] || null;

      return {
        id: url || title,
        title,
        date: date ? new Date(date).toISOString() : '',
        category: 'Article',
        description: description.replace(/<[^>]+>/g, '').slice(0, 180).trim() || 'Read the full post on Substack',
        image,
        url
      };
    })
    .filter(post => post.title && post.url)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 12);
}

async function run() {
  const previous = fs.existsSync(OUTPUT_PATH)
    ? JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf8'))
    : {};
  const sections = {};

  for (const [id, feed] of Object.entries(FEEDS)) {
    try {
      const xml = await fetchText(feed.feedUrl);
      const posts = parseItems(xml);
      const previousPosts = previous.sections?.[id]?.posts || [];
      sections[id] = { ...feed, posts: posts.length || !previousPosts.length ? posts : previousPosts };
      console.log(`Found ${sections[id].posts.length} posts for ${feed.title}.`);
    } catch (error) {
      console.warn(`Failed to fetch ${feed.title}: ${error.message}`);
      sections[id] = { ...feed, posts: previous.sections?.[id]?.posts || [] };
    }
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify({ sections }, null, 2));
  console.log(`Generated ${OUTPUT_PATH}.`);
}

run().catch(error => {
  console.error('Failed to build blog data:', error.message);
  process.exit(1);
});