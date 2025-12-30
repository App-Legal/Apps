const fs = require('fs');
const path = require('path');
const glob = require('glob');

const root = path.resolve(__dirname, '..');

function readAllFiles(patterns) {
  const files = new Set();
  const ignore = ['**/node_modules/**', '**/.nuxt/**', '**/.output/**'];
  patterns.forEach(p => {
    glob.sync(p, { cwd: root, nodir: true, dot: true, ignore }).forEach(f => files.add(path.join(root, f)));
  });
  return Array.from(files);
}

function findLinksInFile(file) {
  const content = fs.readFileSync(file, 'utf8');
  const links = new Set();
  const mdRe = /\[[^\]]+\]\(([^)]+)\)/g;
  let m;
  while ((m = mdRe.exec(content))) {
    links.add(m[1]);
  }
  const attrRe = /(?:src|href)=["']([^"'#>]+)["']/g;
  while ((m = attrRe.exec(content))) {
    links.add(m[1]);
  }
  const impRe = /from\s+['"]([^\'"]+)['"]/g;
  while ((m = impRe.exec(content))) {
    const spec = m[1];
    // only consider relative or root imports (./, ../ or /)
    if (spec.startsWith('.') || spec.startsWith('/')) links.add(spec);
  }
  return Array.from(links).filter(Boolean);
}

function isLocal(link) {
  // consider local only if starts with / or . (relative or root path)
  return link.startsWith('/') || link.startsWith('.');
}

(async function main(){
  const scanPatterns = ['**/*.{md,vue,html,js,ts,jsx,tsx}'];
  const allFiles = readAllFiles(scanPatterns);

  const references = new Map();
  for (const f of allFiles) {
    const links = findLinksInFile(f);
    references.set(f, links);
  }

  const referencedTargets = new Set();
  for (const [file, links] of references) {
    for (const l of links) {
      if (isLocal(l)) {
        let target;
        if (l.startsWith('/')) {
          target = path.join(root, l.substring(1));
        } else {
          const dir = path.dirname(file);
          target = path.resolve(dir, l.split('?')[0].split('#')[0]);
        }
        referencedTargets.add(target);
      }
    }
  }

  const candidatePatterns = ['**/*.{md,vue,html,js,ts,jsx,tsx,png,jpg,jpeg,svg}'];
  const candidates = readAllFiles(candidatePatterns);
  const orphanFiles = candidates.filter(c => {
    if (c.includes(path.sep + 'node_modules' + path.sep) || c.includes(path.sep + '.nuxt' + path.sep) || c.includes(path.sep + '.output' + path.sep)) return false;
    // exclude app and content entry paths from being marked as orphan (they are used at runtime)
    if (c.includes(path.sep + 'app' + path.sep) || c.includes(path.sep + 'content' + path.sep)) return false;
    return !Array.from(referencedTargets).some(rt => rt === c || rt.startsWith(c + path.sep));
  });

  const broken = [];
  for (const [file, links] of references) {
    for (const l of links) {
      if (isLocal(l)) {
        let target;
        if (l.startsWith('/')) {
          target = path.join(root, l.substring(1));
        } else {
          const dir = path.dirname(file);
          target = path.resolve(dir, l.split('?')[0].split('#')[0]);
        }
        if (fs.existsSync(target)) continue;
        // common variants
        if (fs.existsSync(target + '.md') || fs.existsSync(target + '.vue') || fs.existsSync(path.join(target, 'index.md')) || fs.existsSync(path.join(target, 'index.vue'))) continue;
        // nuxt-content mapping: /about -> content/about.md
        if (l.startsWith('/') && fs.existsSync(path.join(root, 'content', l.substring(1) + '.md'))) continue;
        if (l.startsWith('/') && fs.existsSync(path.join(root, 'content', l.substring(1), 'index.md'))) continue;
        broken.push({file: path.relative(root,file), link: l, resolved: path.relative(root, target)});
      }
    }
  }

  console.log('Scan summary:');
  console.log(`- files scanned: ${allFiles.length}`);
  console.log(`- internal broken links: ${broken.length}`);
  if (broken.length) console.table(broken.slice(0,100));
  console.log(`- candidate files: ${candidates.length}`);
  console.log(`- possibly orphan files (conservative): ${orphanFiles.length}`);
  if (orphanFiles.length) console.log(orphanFiles.slice(0,100).map(p => path.relative(root, p)));

  if (broken.length === 0 && orphanFiles.length === 0) {
    console.log('\nNo obvious broken internal links or orphaned files found.');
  }
})();
