const fs = require('fs');
const path = require('path');
const tf = require('@tensorflow/tfjs-node');
const blazeface = require('@tensorflow-models/blazeface');

function findProfileImage() {
  const candidates = ['prof_pic.jpg', 'prof_pic.jpeg', 'prof_pic.png'];
  for (const name of candidates) {
    const p = path.join(__dirname, '..', 'assets', 'images', name);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

async function detectAndApply() {
  const imgPath = findProfileImage();
  if (!imgPath) {
    console.error('Profile image not found in assets/images (prof_pic.jpg/jpeg/png)');
    process.exit(1);
  }

  console.log('Using image:', imgPath);

  const imgBuffer = fs.readFileSync(imgPath);
  const decoded = tf.node.decodeImage(imgBuffer, 3);

  const model = await blazeface.load();
  const returnTensors = false;
  const predictions = await model.estimateFaces(decoded, returnTensors);
  decoded.dispose();

  if (!predictions || predictions.length === 0) {
    console.error('No face detected.');
    process.exit(1);
  }

  const p = predictions[0];
  // BlazeFace returns topLeft and bottomRight when returnTensors=false
  const topLeft = p.topLeft;
  const bottomRight = p.bottomRight;
  const boxX = topLeft[0];
  const boxY = topLeft[1];
  const boxW = bottomRight[0] - topLeft[0];
  const boxH = bottomRight[1] - topLeft[1];

  const faceCenterX = boxX + boxW / 2;
  const faceCenterY = boxY + boxH / 2;

  // Need natural image dimensions; decodeImage gives shape
  const [height, width] = decoded ? decoded.shape.slice(0,2) : [null, null];
  // decoded disposed; instead use image-size via sharp? we'll infer from buffer using tf.node.decodeImage again with keep
  const img2 = tf.node.decodeImage(imgBuffer, 3);
  const [h2, w2] = img2.shape.slice(0,2);
  img2.dispose();

  const posX = Math.round((faceCenterX / w2) * 100);
  const posY = Math.round((faceCenterY / h2) * 100);

  const cssValue = `${posX}% ${posY}%`;
  console.log('Detected center:', cssValue);

  // Update index.html to add or replace inline style for object-position on profile-img
  const indexPath = path.join(__dirname, '..', 'index.html');
  let html = fs.readFileSync(indexPath, 'utf8');

  const imgRegex = /(<img[^>]*class=("|')([^"']*\bprofile-img\b[^"']*)("|')[^>]*>)/i;
  const match = html.match(imgRegex);
  if (!match) {
    console.error('profile img tag not found in index.html');
    process.exit(1);
  }

  const imgTag = match[1];

  if (/style=/.test(imgTag)) {
    const newTag = imgTag.replace(/style=("|')([^"']*)("|')/i, (m, q1, styleContent) => {
      if (/object-position\s*:/i.test(styleContent)) {
        const replaced = styleContent.replace(/object-position\s*:\s*[^;]+;?/i, `object-position: ${cssValue}; `);
        return `style=${q1}${replaced}${q1}`;
      } else {
        const appended = styleContent.trim();
        const needsSemicolon = appended && !/;\s*$/.test(appended) ? '; ' : ' ';
        return `style=${q1}${appended}${needsSemicolon}object-position: ${cssValue};${q1}`;
      }
    });

    html = html.replace(imgTag, newTag);
  } else {
    const newTag = imgTag.replace(/(>)/, ` style="object-position: ${cssValue};"$1`);
    html = html.replace(imgTag, newTag);
  }

  fs.writeFileSync(indexPath, html, 'utf8');
  console.log('Updated index.html with object-position:', cssValue);
}

// Run
(async () => {
  try {
    await detectAndApply();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
