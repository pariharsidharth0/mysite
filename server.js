const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { getAllBooks } = require('./lib/goodreads');
const app = express();

// Set up multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, 'assets'));
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

app.use(express.json());
app.use(express.static(__dirname, { index: false }));

const GOODREADS_USER_ID = '194760406';
const CACHE_TTL = 3600 * 1000; // 1 hour
let lastUpdate = 0;

async function syncGoodreads() {
    const configPath = path.join(__dirname, 'config.json');
    let config;
    try {
        config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch (err) {
        console.error('Failed to read config for sync check:', err);
        return;
    }

    if (config.books_sync_source && config.books_sync_source !== 'goodreads') {
        console.log(`Goodreads background sync skipped because books_sync_source is '${config.books_sync_source}'`);
        return;
    }

    console.log('Syncing with Goodreads...');
    try {
        const books = await getAllBooks(GOODREADS_USER_ID);
        if (books && books.length > 0) {
            config.books = books;
            fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
            lastUpdate = Date.now();
            console.log(`Synced ${books.length} books successfully.`);
        }
    } catch (e) {
        console.error('Failed to sync Goodreads:', e);
    }
}

// Utility to render the template
function renderIndex(res) {
    const configPath = path.join(__dirname, 'config.json');
    let config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    let html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

    // Replace hero
    html = html.replace('{{HERO_LINE1}}', config.hero.line1);
    html = html.replace('{{HERO_LINE2}}', config.hero.line2);
    html = html.replace('{{HERO_SUBTEXT}}', config.hero.subtext);

    // Replace manifesto
    html = html.replace('{{MANIFESTO_TEXT}}', config.manifesto.text);

    // Replace about
    html = html.replace('{{ABOUT_TEXT}}', config.about);

    // Replace Experience
    let expHtml = '';
    config.experience.forEach(e => {
        expHtml += `
        <div class="exp-row">
            <div class="exp-title">${e.role} @ ${e.company}</div>
            <div class="exp-date">${e.duration}</div>
            <div class="exp-desc">${e.desc}</div>
        </div>
        `;
    });
    html = html.replace('{{EXPERIENCE_ITEMS}}', expHtml);

    // Replace Skills
    let skillsHtml = '';
    config.skills.forEach(s => {
        skillsHtml += `<span class="skill-pill">${s}</span>`;
    });
    html = html.replace('{{SKILLS_PILLS}}', skillsHtml);

    // Replace parallax
    html = html.replace('{{PARALLAX_TITLE}}', config.parallax.title);
    html = html.replace('{{PARALLAX_IMAGE}}', config.parallax.image);

    // Replace contact
    html = html.replace('{{NAME}}', config.contact.name);
    html = html.replace('{{CONTACT_EMAIL}}', config.contact.email);
    html = html.replace('{{LINKEDIN_URL}}', config.contact.linkedin);
    html = html.replace('{{INSTAGRAM_URL}}', config.contact.instagram);
    html = html.replace('{{GITHUB_URL}}', config.contact.github);
    html = html.replace('{{STEAM_URL}}', config.contact.steam);
    html = html.replace('{{CV_URL}}', config.contact.cv_url);

    // Replace GitHub Projects
    let githubHtml = '';
    config.github_projects.forEach(p => {
        githubHtml += `
        <a href="${p.url}" target="_blank" class="github-card">
            <h3>${p.title}</h3>
            <p>${p.desc}</p>
        </a>
        `;
    });
    html = html.replace('{{GITHUB_PROJECTS}}', githubHtml);

    // Replace Steam Games
    let steamHtml = '';
    config.steam_games.forEach(g => {
        steamHtml += `
        <div class="steam-card">
            <div class="steam-image" style="background-image: url('${g.image}');"></div>
            <div class="steam-info">
                <h4>${g.title}</h4>
            </div>
        </div>
        `;
    });
    html = html.replace('{{STEAM_GAMES}}', steamHtml);
    
    // Replace Books
    let booksHtml = '';
    config.books.forEach((b, index) => {
        const stars = b.user_rating ? '★'.repeat(Math.round(b.user_rating)) + '☆'.repeat(5 - Math.round(b.user_rating)) : '';
        const statusLabel = b.reading_status ? `<span class="status-badge">${b.reading_status.replace('-', ' ')}</span>` : '';
        const highlightClass = b.highlight ? 'highlight-book' : '';
        const hiddenClass = index >= 6 ? ' hidden-book' : '';
        
        const bookUrl = (b.goodreads_url && b.goodreads_url.startsWith('http')) 
            ? b.goodreads_url 
            : `https://www.google.com/search?q=${encodeURIComponent(b.title + ' ' + b.author)}`;

        booksHtml += `
        <a href="${bookUrl}" target="_blank" class="book-card ${highlightClass}${hiddenClass}">
            <div class="book-image" style="background-image: url('${b.cover_image}');"></div>
            <div class="book-overlay">
                <div class="book-details">
                    <p class="book-rating">${stars}</p>
                    ${statusLabel}
                </div>
            </div>
            <div class="book-info">
                <h4>${b.title}</h4>
                <p>${b.author}</p>
            </div>
        </a>
        `;
    });
    html = html.replace('{{BOOKS_ITEMS}}', booksHtml);
    html = html.replace('{{BOOKS_SECTION_TITLE}}', config.books_section_title || 'BOOKS // GOODREADS');

    // Replace Gallery
    let galleryHtml = '';
    config.gallery.forEach(g => {
        galleryHtml += `
        <div class="gallery-item">
            <div class="gallery-image" style="background-image: url('${g.image}');"></div>
        </div>
        `;
    });
    html = html.replace('{{GALLERY_ITEMS}}', galleryHtml);

    // Replace Work slides
    let workSlidesHtml = '';
    config.work.forEach(w => {
        workSlidesHtml += `
        <div class="slide">
            <div class="slide-bg" style="background-image: url('${w.image}');"></div>
            <div class="slide-overlay"></div>
            <div class="slide-content">
                <div class="slide-header">
                    <h3>${w.title}</h3>
                    <p class="slide-number">${w.number}</p>
                </div>
                <p class="slide-desc">${w.desc}</p>
            </div>
        </div>
        `;
    });
    html = html.replace('{{WORK_SLIDES}}', workSlidesHtml);

    res.send(html);
}

// Routes
app.get('/', async (req, res) => {
    try {
        const configPath = path.join(__dirname, 'config.json');
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        
        // Auto-refresh if cache expired and Goodreads sync is active
        if (config.books_sync_source === 'goodreads' && Date.now() - lastUpdate > CACHE_TTL) {
            syncGoodreads(); // Run in background
        }
        renderIndex(res);
    } catch (e) {
        res.sendFile(path.join(__dirname, 'index.html'));
    }
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

app.get('/api/config', (req, res) => {
    res.sendFile(path.join(__dirname, 'config.json'));
});

app.post('/api/config', (req, res) => {
    const configPath = path.join(__dirname, 'config.json');
    fs.writeFileSync(configPath, JSON.stringify(req.body, null, 2));
    res.json({ success: true });
});

app.post('/api/upload', upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, error: 'No file uploaded' });
    }
    // Return the URL path to the uploaded file
    res.json({ success: true, url: '/assets/' + req.file.filename });
});

const PORT = 8000;
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`Admin dashboard at http://localhost:${PORT}/admin`);
    
    // Initial sync on startup
    syncGoodreads();
});
