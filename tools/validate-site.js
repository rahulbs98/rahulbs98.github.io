const fs = require('fs');

const requiredFiles = [
  'index.html',
  'blog.html',
  'news.html',
  'research.html',
  'assets/data/albums.json',
  'assets/data/publications.json',
  'assets/data/blog.json',
  'assets/data/news.json'
];

for (const file of requiredFiles) {
  if (!fs.existsSync(file)) {
    throw new Error(`Missing required file: ${file}`);
  }
}

const albums = JSON.parse(fs.readFileSync('assets/data/albums.json', 'utf8'));
const publications = JSON.parse(fs.readFileSync('assets/data/publications.json', 'utf8'));
const blog = JSON.parse(fs.readFileSync('assets/data/blog.json', 'utf8'));
const homepage = fs.readFileSync('index.html', 'utf8');
const blogPage = fs.readFileSync('blog.html', 'utf8');

if (!Array.isArray(albums)) throw new Error('albums.json must contain an array');
if (!Array.isArray(publications)) throw new Error('publications.json must contain an array');
if (!blog.sections || typeof blog.sections !== 'object') {
  throw new Error('blog.json.sections must contain the blog sections');
}
if (Object.values(blog.sections).some(section => !Array.isArray(section.posts))) {
  throw new Error('Every blog section must contain a posts array');
}
if (!homepage.includes('assets/images/prof_pic.jpg')) {
  throw new Error('Homepage profile image reference is missing');
}
if (!blogPage.includes('assets/data/blog.json')) {
  throw new Error('Blog page is not using the local blog snapshot');
}
if (!fs.readFileSync('news.html', 'utf8').includes('assets/data/news.json')) {
  throw new Error('News page is not using the local news snapshot');
}

const blogPostCount = Object.values(blog.sections).reduce((total, section) => total + section.posts.length, 0);
console.log(`Site validation passed: ${albums.length} photos, ${publications.length} publications, ${blogPostCount} blog posts.`);