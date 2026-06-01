const fs = require('fs');
const path = require('path');

/**
 * Static Build Script for Sidharth Parihar Portfolio
 * This script generates a static 'dist' folder ready for GitHub Pages.
 */

function build() {
    const distDir = path.join(__dirname, 'dist');
    const assetsDir = path.join(__dirname, 'assets');
    const distAssetsDir = path.join(distDir, 'assets');

    // 1. Create dist folder
    if (!fs.existsSync(distDir)) {
        fs.mkdirSync(distDir);
    }

    // 2. Read data and template
    const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
    let html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

    // 3. Perform replacements (Logic copied from server.js)
    html = html.replace('{{HERO_LINE1}}', config.hero.line1);
    html = html.replace('{{HERO_LINE2}}', config.hero.line2);
    html = html.replace('{{HERO_SUBTEXT}}', config.hero.subtext);
    html = html.replace('{{MANIFESTO_TEXT}}', config.manifesto.text);
    html = html.replace('{{ABOUT_TEXT}}', config.about);

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

    let skillsHtml = '';
    config.skills.forEach(s => {
        skillsHtml += `<span class="skill-pill">${s}</span>`;
    });
    html = html.replace('{{SKILLS_PILLS}}', skillsHtml);

    html = html.replace('{{PARALLAX_TITLE}}', config.parallax.title);
    html = html.replace('{{PARALLAX_IMAGE}}', config.parallax.image);
    html = html.replace('{{NAME}}', config.contact.name);
    html = html.replace('{{CONTACT_EMAIL}}', config.contact.email);
    html = html.replace('{{LINKEDIN_URL}}', config.contact.linkedin);
    html = html.replace('{{INSTAGRAM_URL}}', config.contact.instagram);
    html = html.replace('{{GITHUB_URL}}', config.contact.github);
    html = html.replace('{{STEAM_URL}}', config.contact.steam);
    html = html.replace('{{CV_URL}}', config.contact.cv_url);

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

    let galleryHtml = '';
    config.gallery.forEach(g => {
        galleryHtml += `
        <div class="gallery-item">
            <div class="gallery-image" style="background-image: url('${g.image}');"></div>
        </div>
        `;
    });
    html = html.replace('{{GALLERY_ITEMS}}', galleryHtml);

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

    // 4. Write final index.html
    fs.writeFileSync(path.join(distDir, 'index.html'), html);

    // 5. Copy CSS and JS
    fs.copyFileSync(path.join(__dirname, 'style.css'), path.join(distDir, 'style.css'));
    fs.copyFileSync(path.join(__dirname, 'script.js'), path.join(distDir, 'script.js'));

    // 6. Copy Assets folder
    if (fs.existsSync(assetsDir)) {
        if (!fs.existsSync(distAssetsDir)) fs.mkdirSync(distAssetsDir);
        fs.readdirSync(assetsDir).forEach(file => {
            fs.copyFileSync(path.join(assetsDir, file), path.join(distAssetsDir, file));
        });
    }

    console.log('Build complete! Your static site is in the "dist" folder.');
    console.log('To deploy to GitHub Pages:');
    console.log('1. Upload the contents of "dist" to your GitHub repository.');
    console.log('2. Enable GitHub Pages in your repository settings.');
}

build();
