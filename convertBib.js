const fs = require('fs');
const https = require('https');
const bibtexParse = require('bibtex-parse-js');

const DBLP_BIB_URL = 'https://dblp.org/pid/370/6614.bib';
const SCHOLAR_PROFILE_URL = 'https://scholar.google.com/citations?user=LskQKm0AAAAJ&hl=en';
const BIB_PATH = 'publications.bib';
const JSON_PATH = 'assets/data/publications.json';

function fetchText(url, headers = {}) {
	return new Promise((resolve, reject) => {
		https.get(url, { headers }, res => {
			if (res.statusCode < 200 || res.statusCode >= 300) {
				reject(new Error(`Fetch failed for ${url}: ${res.statusCode}`));
				return;
			}

			let data = '';
			res.on('data', chunk => {
				data += chunk;
			});
			res.on('end', () => resolve(data));
		}).on('error', reject);
	});
}

function decodeHtml(value) {
	return value
		.replace(/&#39;|&apos;/g, "'")
		.replace(/&quot;/g, '"')
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/\s+/g, ' ')
		.trim();
}

function titleKey(value) {
	return value
		.toLowerCase()
		.replace(/[{}]/g, '')
		.replace(/[^a-z0-9]+/g, ' ')
		.trim();
}

function conferenceShortName(value) {
	const name = String(value || '').replace(/[{}]/g, '').replace(/\s+/g, ' ').trim();
	const knownNames = [
		[/security and cryptography/i, 'SCN'],
		[/asiacrypt/i, 'ASIACRYPT'],
		[/eurocrypt/i, 'EUROCRYPT'],
		[/cryptology and network security/i, 'CANS'],
		[/privacy enhancing technologies/i, 'PETS']
	];
	for (const [pattern, shortName] of knownNames) {
		if (pattern.test(name)) return shortName;
	}
	const acronym = name.match(/\b[A-Z][A-Z0-9-]{2,}\b/);
	return acronym ? acronym[0] : name;
}

function parseScholarPublications(html) {
	return [...html.matchAll(/<tr class="gsc_a_tr">([\s\S]*?)<\/tr>/g)]
		.map(match => {
			const row = match[1];
			const titleMatch = row.match(/<a([^>]*)class="gsc_a_at"([^>]*)>([\s\S]*?)<\/a>/);
			const yearMatch = row.match(/class="gsc_a_h[^>]*>(\d{4})<\/span>/);
			const grayFields = [...row.matchAll(/<div class="gs_gray">([\s\S]*?)<\/div>/g)]
				.map(field => decodeHtml(field[1].replace(/<[^>]+>/g, '')));
			if (!titleMatch || !yearMatch) return null;
			const hrefMatch = `${titleMatch[1]}${titleMatch[2]}`.match(/href="([^"]+)"/);
			if (!hrefMatch) return null;
			const scholarUrl = new URL(decodeHtml(hrefMatch[1]), 'https://scholar.google.com').toString();
			const sourceField = (grayFields[1] || '').replace(/,\s*\d{4}$/, '');
			const directUrl = /^https?:\/\//i.test(sourceField) ? sourceField : '';
			const venue = directUrl
				? new URL(directUrl).hostname.replace(/^www\./, '')
				: sourceField.replace(/,\s*\d{4}$/, '') || 'Google Scholar';

			return {
				citationKey: `scholar-${titleKey(titleMatch[3]).replace(/ /g, '-')}`,
				entryType: 'article',
				entryTags: {
					title: decodeHtml(titleMatch[3]),
					author: grayFields[0] || 'Unknown Authors',
					year: yearMatch[1],
					journal: venue,
					url: directUrl || scholarUrl,
					scholarUrl: scholarUrl
				}
			};
		})
		.filter(Boolean);
}

function parseScholarVersions(html) {
	const mainLink = html.match(/<a class="gsc_oci_title_link" href="([^"]+)"/i);
	const cameraReadyUrl = mainLink ? decodeHtml(mainLink[1]) : '';
	const eprintMatch = html.match(/href="(https?:\/\/[^" ]*eprint[^" ]*)"/i);
	const snippets = [...html.matchAll(/<div class="gsc_oci_merged_snippet">([\s\S]*?)<a class="gsc_oms_link/gi)];
	for (const snippet of snippets) {
		const fields = [...snippet[1].matchAll(/<div>([\s\S]*?)<\/div>/g)]
			.map(field => decodeHtml(field[1].replace(/<[^>]+>/g, '')));
		const details = fields[1] || '';
		if (!details || /eprint|arxiv/i.test(details) || !/conference|SCN|security and cryptography|cryptology/i.test(details)) {
			continue;
		}

		const separator = details.indexOf(' - ');
		const venue = (separator >= 0 ? details.slice(separator + 3) : details)
			.replace(/,\s*\d{4}.*$/, '')
			.trim();
		if (venue) {
			return {
				venue,
				cameraReadyUrl,
				eprintUrl: eprintMatch ? decodeHtml(eprintMatch[1]) : ''
			};
		}
	}
	return {
		venue: '',
		cameraReadyUrl,
		eprintUrl: eprintMatch ? decodeHtml(eprintMatch[1]) : ''
	};
}

async function enrichScholarConferences(entries) {
	return Promise.all(entries.map(async entry => {
		const scholarUrl = entry.entryTags?.scholarUrl;
		if (!scholarUrl) return entry;
		try {
			const html = await fetchText(scholarUrl, { 'User-Agent': 'Mozilla/5.0 (compatible; website build)' });
			const versions = parseScholarVersions(html);
			return {
				...entry,
				entryTags: {
					...entry.entryTags,
					scholarConferenceVenue: versions.venue,
					conferenceShortName: conferenceShortName(versions.venue),
					scholarCameraReadyUrl: versions.cameraReadyUrl,
					scholarEprintUrl: versions.eprintUrl
				}
			};
		} catch (error) {
			console.warn(`Scholar conference lookup skipped: ${error.message}`);
			return entry;
		}
	}));
}

function isConferenceEntry(entry) {
	return entry.entryType === 'inproceedings' || Boolean(entry.entryTags?.booktitle);
}

function isEprintEntry(entry) {
	return /eprint|iacr.*eprint/i.test(entry.entryTags?.journal || '');
}

function mergeEntry(existing, candidate) {
	const preferred = isConferenceEntry(candidate) && !isConferenceEntry(existing)
		? candidate
		: existing;
	const other = preferred === existing ? candidate : existing;
	const eprintEntry = isEprintEntry(existing) ? existing : isEprintEntry(candidate) ? candidate : null;
	const mergedTags = {
		...other.entryTags,
		...preferred.entryTags,
		eprintUrl: eprintEntry?.entryTags?.url || preferred.entryTags?.eprintUrl || '',
		dblpUrl: preferred.entryTags?.biburl
			? preferred.entryTags.biburl.replace(/\.bib$/, '')
			: existing.entryTags?.dblpUrl || ''
	};
	if (isConferenceEntry(preferred)) {
		mergedTags.conferenceShortName = preferred.entryTags?.conferenceShortName
			|| conferenceShortName(preferred.entryTags?.booktitle || preferred.entryTags?.journal);
	}
	if (isConferenceEntry(preferred)) delete mergedTags.journal;

	return {
		...preferred,
		entryTags: mergedTags
	};
}

function mergePublications(dblpEntries, scholarEntries) {
	const merged = [];
	const existingByTitle = new Map();

	for (const entry of dblpEntries) {
		const key = titleKey(entry.entryTags?.title || '');
		const existingIndex = existingByTitle.get(key);
		if (existingIndex === undefined) {
			merged.push(mergeEntry(entry, entry));
			existingByTitle.set(key, merged.length - 1);
		} else {
			merged[existingIndex] = mergeEntry(merged[existingIndex], entry);
		}
	}

	for (const entry of scholarEntries) {
		const key = titleKey(entry.entryTags.title);
		const existingIndex = existingByTitle.get(key);
		if (existingIndex !== undefined) {
			merged[existingIndex].entryTags.scholarUrl = entry.entryTags.scholarUrl;
			if (entry.entryTags.scholarEprintUrl) {
				merged[existingIndex].entryTags.eprintUrl = entry.entryTags.scholarEprintUrl;
			}
			if (entry.entryTags.scholarConferenceVenue && !isConferenceEntry(merged[existingIndex])) {
				merged[existingIndex].entryType = 'inproceedings';
				merged[existingIndex].entryTags.booktitle = entry.entryTags.scholarConferenceVenue;
				merged[existingIndex].entryTags.conferenceShortName = entry.entryTags.conferenceShortName;
				delete merged[existingIndex].entryTags.journal;
			}
			if (entry.entryTags.scholarCameraReadyUrl && isConferenceEntry(merged[existingIndex])) {
				merged[existingIndex].entryTags.url = entry.entryTags.scholarCameraReadyUrl;
			}
		} else if (key) {
			merged.push(entry);
			existingByTitle.set(key, merged.length - 1);
		}
	}

	return merged;
}

async function buildPublications() {
	let dblpEntries = [];
	try {
		console.log('Fetching BibTeX from DBLP...');
		const bibFile = await fetchText(DBLP_BIB_URL, { 'User-Agent': 'rahulbs98.github.io build' });
		if (/^\s*<!doctype html/i.test(bibFile)) {
			throw new Error('DBLP returned an HTML challenge instead of BibTeX');
		}
		fs.writeFileSync(BIB_PATH, bibFile);
		console.log(`Updated ${BIB_PATH}`);
		dblpEntries = bibtexParse.toJSON(bibFile);
	} catch (error) {
		console.warn(`DBLP fetch skipped: ${error.message}`);
		if (fs.existsSync(BIB_PATH)) {
			dblpEntries = bibtexParse.toJSON(fs.readFileSync(BIB_PATH, 'utf8'));
			console.warn(`Using ${BIB_PATH} as the DBLP fallback.`);
		} else if (fs.existsSync(JSON_PATH)) {
			dblpEntries = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
			console.warn(`Using ${JSON_PATH} as the DBLP fallback.`);
		}
	}

	let scholarEntries = [];
	try {
		console.log('Fetching publications from Google Scholar...');
		const scholarHtml = await fetchText(SCHOLAR_PROFILE_URL, {
			'User-Agent': 'Mozilla/5.0 (compatible; website build)'
		});
		scholarEntries = parseScholarPublications(scholarHtml);
		console.log(`Found ${scholarEntries.length} Scholar publications.`);
	} catch (error) {
		console.warn(`Google Scholar fetch skipped: ${error.message}`);
	}

	const enrichedScholarEntries = await enrichScholarConferences(scholarEntries);
	const entries = mergePublications(dblpEntries, enrichedScholarEntries);
	fs.writeFileSync(JSON_PATH, JSON.stringify(entries, null, 2));
	console.log(`Generated ${JSON_PATH} with ${entries.length} unique publications.`);
}

buildPublications().catch(error => {
	console.error('Failed to build publications:', error.message);
	process.exit(1);
});