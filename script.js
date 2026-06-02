// Register GSAP Plugins
gsap.registerPlugin(ScrollTrigger);

document.addEventListener("DOMContentLoaded", () => {

    // Respect the OS "reduce motion" accessibility setting
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // --- Preloader Sequence ---
    let progress = 0;
    const counter = document.querySelector('.preloader-counter');
    const interval = setInterval(() => {
        progress += Math.floor(Math.random() * 10) + 5;
        if (progress >= 100) {
            progress = 100;
            clearInterval(interval);
            
            // Animate preloader out
            gsap.to('.preloader', {
                yPercent: -100,
                duration: 1.2,
                ease: "power4.inOut",
                onComplete: initAnimations // Start main animations after load
            });
        }
        if(counter) counter.innerText = progress + "%";
    }, 50);

    // --- Books preview: 6 top-rated + 14 random (20 visible) ---
    // The renderers (server.js / build.js) emit books in config order with a
    // data-rating attribute and hide index >= 20 via .hidden-book. We override
    // that on the client so each page load previews 20 books: the 6 highest by
    // user_rating pinned first (tie within the 5-star tier broken randomly),
    // then 14 random books from the rest. The remaining books stay hidden until
    // "SHOW ALL BOOKS". Runs during the preloader, before initAnimations(), so
    // the pre-reorder state is never seen.
    (() => {
        const grid = document.querySelector('.books-grid');
        if (!grid) return;
        const cards = Array.from(grid.querySelectorAll('.book-card'));
        if (!cards.length) return;
        const VISIBLE = 20, TOP = 6;

        const shuffle = (arr) => {
            for (let i = arr.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [arr[i], arr[j]] = [arr[j], arr[i]];
            }
            return arr;
        };
        const rating = (c) => parseFloat(c.dataset.rating) || 0;

        let ordered;
        if (cards.length > VISIBLE) {
            // Pre-shuffle, then stable-sort by rating desc: ties (the 5-star tier)
            // end up in random order, so the top 6 rotate across loads.
            const pool = shuffle(cards.slice());
            pool.sort((a, b) => rating(b) - rating(a));
            const topRated = pool.slice(0, TOP);       // 6 highest-rated
            const fill = shuffle(pool.slice(TOP));      // remaining books, randomized
            ordered = [...topRated, ...fill];           // 6 top, then 14 random, then rest
        } else {
            ordered = cards.slice();
        }

        ordered.forEach((card, index) => {
            card.classList.remove('hidden-book', 'show-book');
            if (index >= VISIBLE) card.classList.add('hidden-book');
        });

        // Distribute into vertical columns for the parallax-depth layout. Each
        // column is driven at a different scroll speed in initAnimations(). The
        // round-robin keeps the top-rated picks spread across columns, and hidden
        // books (index >= VISIBLE) trail the bottom of each column so "Show all"
        // simply appends them in place. Column count scales down on narrow screens.
        const COLS = window.innerWidth < 700 ? 2 : (window.innerWidth < 1000 ? 3 : 4);
        grid.innerHTML = '';
        const columns = [];
        for (let i = 0; i < COLS; i++) {
            const col = document.createElement('div');
            col.className = 'book-col';
            grid.appendChild(col);
            columns.push(col);
        }
        ordered.forEach((card, i) => columns[i % COLS].appendChild(card));
    })();

    // --- Book Cover Fallback Handler ---
    // Cover URLs are resolved at build time by scripts/fetch-covers.js and baked
    // into config.json, so primaries almost always load. This is a last-resort
    // safety net: if a cover 404s at view time, mark the tile so CSS can show a
    // clean titled placeholder instead of an empty box.
    document.querySelectorAll('.book-card .book-image').forEach(el => {
        const url = el.style.backgroundImage.match(/url\(["']?([^"']+)["']?\)/)?.[1];
        if (!url) {
            el.classList.add('cover-missing');
            return;
        }
        const probe = new Image();
        probe.onerror = () => el.classList.add('cover-missing');
        probe.src = url;
    });

    // --- Lenis Smooth Scrolling Setup ---
    const lenis = new Lenis({
        duration: 1.2,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        direction: 'vertical',
        smooth: true,
    });

    function raf(time) {
        lenis.raf(time);
        requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time)=>{ lenis.raf(time * 1000); });
    gsap.ticker.lagSmoothing(0, 0);

    // --- Custom Cursor (Lag-Free) ---
    const cursor = document.querySelector('.cursor');
    
    // Set initial center alignment via GSAP so it stacks correctly
    gsap.set(cursor, { xPercent: -50, yPercent: -50 });

    // Create high-performance setters with virtually zero duration for instant tracking
    const xTo = gsap.quickTo(cursor, "x", {duration: 0.02, ease: "power3"});
    const yTo = gsap.quickTo(cursor, "y", {duration: 0.02, ease: "power3"});

    window.addEventListener('mousemove', (e) => {
        xTo(e.clientX);
        yTo(e.clientY);
    });

    // Hover effects
    document.querySelectorAll('a, .center-frame, .magnetic-btn').forEach(el => {
        el.addEventListener('mouseenter', () => cursor.classList.add('active'));
        el.addEventListener('mouseleave', () => cursor.classList.remove('active'));
    });

    // Magnetic Button
    const magneticBtn = document.querySelector('.magnetic-btn');
    if(magneticBtn) {
        magneticBtn.addEventListener('mousemove', (e) => {
            const rect = magneticBtn.getBoundingClientRect();
            const x = e.clientX - rect.left - rect.width / 2;
            const y = e.clientY - rect.top - rect.height / 2;
            gsap.to(magneticBtn, { x: x * 0.4, y: y * 0.4, duration: 0.5, ease: "power2.out" });
        });
        magneticBtn.addEventListener('mouseleave', () => {
            gsap.to(magneticBtn, { x: 0, y: 0, duration: 0.7, ease: "elastic.out(1, 0.3)" });
        });
    }

    // --- Skills Marquee (built from the rendered skill pills) ---
    const marquee = document.getElementById('skills-marquee');
    const pills = document.querySelectorAll('.skill-pill');
    if (marquee && pills.length) {
        const names = Array.from(pills).map(p => p.textContent.trim());
        const track = document.createElement('div');
        track.className = 'marquee-track';
        // Duplicate the list so the -50% scroll loops seamlessly
        [...names, ...names].forEach(n => {
            const span = document.createElement('span');
            span.textContent = n;
            track.appendChild(span);
        });
        marquee.appendChild(track);
    }

    // --- Hide the "DOWNLOAD CV" button when no real URL is configured ---
    const cvBtn = document.querySelector('.cv-btn');
    if (cvBtn) {
        const href = cvBtn.getAttribute('href');
        if (!href || href === '#') cvBtn.style.display = 'none';
    }

    // --- Books "Show all" toggle (wired here so it works under reduced motion too) ---
    const bookToggleBtn = document.getElementById('books-toggle-btn');
    if (bookToggleBtn) {
        bookToggleBtn.addEventListener('click', () => {
            const hiddenBooks = document.querySelectorAll('.hidden-book');
            const isExpanded = bookToggleBtn.classList.contains('expanded');

            if (isExpanded) {
                hiddenBooks.forEach(book => book.classList.remove('show-book'));
                bookToggleBtn.querySelector('.btn-text').innerText = 'SHOW ALL BOOKS';
                bookToggleBtn.classList.remove('expanded');
                lenis.scrollTo('.books-section', { offset: -50, duration: 1.2 });
            } else {
                hiddenBooks.forEach((book, i) => {
                    book.classList.add('show-book');
                    if (!prefersReduced) {
                        gsap.fromTo(book, { opacity: 0, y: 40, scale: 0.96 }, { opacity: 1, y: 0, scale: 1, duration: 0.7, delay: (i % 8) * 0.04, ease: "power3.out" });
                    }
                });
                bookToggleBtn.querySelector('.btn-text').innerText = 'SHOW LESS';
                bookToggleBtn.classList.add('expanded');
            }
            ScrollTrigger.refresh();
        });
    }

    // --- Main Animations ---
    function initAnimations() {

        // Reduced motion: reveal everything immediately, skip the scroll choreography
        if (prefersReduced) {
            gsap.set(".hero-title .line", { y: "0%" });
            return;
        }


        // PRE-HIDE all animated elements before anything runs
        gsap.set([
            ".experience-section .section-title",
            ".exp-row",
            ".skills-section .section-title",
            ".skill-pill",
            ".github-section .section-title",
            ".github-card",
            ".steam-section .section-title",
            ".gallery-section .section-title",
            ".gallery-item",
            ".huge-text",
            ".magnetic-btn",
            ".social-links a"
        ], { opacity: 0, y: 0 });

        // HERO: Lines slam up from below (already hidden via CSS transform)
        gsap.to(".hero-title .line", {
            y: "0%",
            duration: 1.5,
            stagger: 0.15,
            ease: "power4.out"
        });
        // Hero subtext fades + slides left
        gsap.set(".hero-subtext", { opacity: 0, x: -40 });
        gsap.to(".hero-subtext", {
            opacity: 1, x: 0, duration: 1.2, delay: 0.6, ease: "power3.out"
        });
        // CV button pops in
        gsap.set(".cv-btn", { opacity: 0, scale: 0.8 });
        gsap.to(".cv-btn", {
            opacity: 1, scale: 1, duration: 0.8, delay: 0.9, ease: "back.out(1.7)"
        });

        // ABOUT: Words stagger up from below
        const aboutText = document.querySelector('.about-section .large-text');
        if (aboutText) {
            const words = aboutText.innerText.split(' ');
            aboutText.innerHTML = words.map(w => '<span class="word-wrap"><span class="word">' + w + '</span></span>').join(' ');
            gsap.set(".about-section .word", { opacity: 0, y: "100%" });
            gsap.to(".about-section .word", {
                scrollTrigger: { trigger: ".about-section", start: "top 75%", once: true },
                opacity: 1, y: "0%",
                duration: 0.7, stagger: 0.04, ease: "power3.out"
            });
        }

        // EXPERIENCE: Title slides in from left; rows stagger
        gsap.set(".experience-section .section-title", { opacity: 0, x: -80 });
        gsap.to(".experience-section .section-title", {
            scrollTrigger: { trigger: ".experience-section", start: "top 80%", once: true },
            x: 0, opacity: 1, duration: 0.9, ease: "power3.out"
        });
        gsap.utils.toArray(".exp-row").forEach((row, i) => {
            gsap.set(row, { opacity: 0, x: -60 });
            gsap.to(row, {
                scrollTrigger: { trigger: row, start: "top 88%", once: true },
                x: 0, opacity: 1,
                duration: 0.8, delay: i * 0.12, ease: "power3.out"
            });
        });

        // TECHNICAL STACK: Title drops from above; pills scatter-pop
        gsap.set(".skills-section .section-title", { opacity: 0, y: -50 });
        gsap.to(".skills-section .section-title", {
            scrollTrigger: { trigger: ".skills-section", start: "top 80%", once: true },
            y: 0, opacity: 1, duration: 0.8, ease: "power3.out"
        });
        gsap.utils.toArray(".skill-pill").forEach((pill, i) => {
            gsap.set(pill, { opacity: 0, scale: 0 });
            gsap.to(pill, {
                scrollTrigger: { trigger: ".skills-section", start: "top 75%", once: true },
                scale: 1, opacity: 1,
                duration: 0.5, delay: i * 0.06, ease: "back.out(2)"
            });
        });

        // GITHUB: Title flips on X axis; cards rise up
        gsap.set(".github-section .section-title", { opacity: 0, rotateX: -90, transformOrigin: "top center" });
        gsap.to(".github-section .section-title", {
            scrollTrigger: { trigger: ".github-section", start: "top 80%", once: true },
            rotateX: 0, opacity: 1, duration: 0.9, ease: "power3.out"
        });
        gsap.utils.toArray(".github-card").forEach((card, i) => {
            gsap.set(card, { opacity: 0, y: 80 });
            gsap.to(card, {
                scrollTrigger: { trigger: card, start: "top 88%", once: true },
                y: 0, opacity: 1,
                duration: 0.8, delay: i * 0.12, ease: "power3.out"
            });
        });

        // MANIFESTO: Words blur + fade in
        const manifestoEl = document.querySelector('.manifesto-section .large-text');
        if (manifestoEl) {
            const mWords = manifestoEl.innerText.split(' ');
            manifestoEl.innerHTML = mWords.map(w => '<span class="word-wrap"><span class="word">' + w + '</span></span>').join(' ');
            gsap.set(".manifesto-section .word", { opacity: 0, filter: "blur(12px)" });
            gsap.to(".manifesto-section .word", {
                scrollTrigger: { trigger: ".manifesto-section", start: "top 75%", once: true },
                filter: "blur(0px)", opacity: 1,
                duration: 0.9, stagger: 0.05, ease: "power2.out"
            });
        }

        // Books — title reveal + parallax-depth columns + velocity skew
        const booksGrid = document.querySelector('.books-grid');
        if (booksGrid) {
            gsap.set(".books-section .section-title", { opacity: 0, x: -100 });
            gsap.to(".books-section .section-title", {
                scrollTrigger: { trigger: ".books-section", start: "top 80%", once: true },
                x: 0, opacity: 1, duration: 0.9, ease: "power3.out"
            });

            // Per-card scrubbed 3D entrance — covers rise + un-tilt as they cross
            // the viewport (visible cards only; revealed books fade via the
            // Show-all handler). Scrub ties it to scroll position rather than firing once.
            gsap.utils.toArray(".book-card:not(.hidden-book)").forEach(card => {
                gsap.fromTo(card,
                    { opacity: 0, y: 60, rotateX: -24, transformOrigin: "50% 100%" },
                    { opacity: 1, y: 0, rotateX: 0, ease: "power2.out",
                      scrollTrigger: { trigger: card, start: "top 95%", end: "top 62%", scrub: true } });
            });

            // Depth parallax + velocity skew: wide screens only. Touch falls back
            // to a plain multi-column grid (mobile CSS), matching the no-pin games path.
            if (window.innerWidth >= 900) {
                const speeds = [0.12, -0.06, 0.16, -0.10]; // per-column drift; alternating sign = depth
                gsap.utils.toArray(".book-col").forEach((col, i) => {
                    const sp = speeds[i % speeds.length];
                    gsap.fromTo(col, { yPercent: sp * -50 }, {
                        yPercent: sp * 50, ease: "none",
                        scrollTrigger: { trigger: ".books-section", start: "top bottom", end: "bottom top", scrub: true }
                    });
                });
                // Whole-grid skew driven by Lenis scroll velocity; settles when you stop.
                const skewTo = gsap.quickTo(booksGrid, "skewY", { duration: 0.5, ease: "power3" });
                const scaleTo = gsap.quickTo(booksGrid, "scaleY", { duration: 0.5, ease: "power3" });
                lenis.on('scroll', ({ velocity }) => {
                    const v = Math.max(-40, Math.min(40, velocity || 0));
                    skewTo(v * 0.05);
                    scaleTo(1 + Math.min(0.035, Math.abs(v) * 0.0008));
                });
            }
        }

        // Games — title reveal + cinematic horizontal shelf (pin + sideways pan)
        const steamTrack = document.querySelector('.steam-track');
        if (steamTrack) {
            gsap.set(".steam-section .section-title", { opacity: 0, x: 100 });
            gsap.to(".steam-section .section-title", {
                scrollTrigger: { trigger: ".steam-section", start: "top 80%", once: true },
                x: 0, opacity: 1, duration: 0.9, ease: "power3.out"
            });

            const total = steamTrack.querySelectorAll('.steam-card').length;
            const count = document.querySelector('.steam-count');
            const bar = document.querySelector('.steam-progress i');
            if (count) count.textContent = '01 / ' + String(total).padStart(2, '0');

            // Pin + pan on wider screens, and only when the track actually overflows
            // (ultrawide may fit everything → no pin). Touch uses the native
            // scroll-snap strip from the mobile CSS, so the pin is skipped there.
            const overflow = steamTrack.scrollWidth - window.innerWidth;
            if (window.innerWidth > 768 && total > 0 && overflow > 0) {
                const distance = () => Math.max(0, steamTrack.scrollWidth - window.innerWidth);
                gsap.to(steamTrack, {
                    x: () => -distance(),
                    ease: "none",
                    scrollTrigger: {
                        trigger: ".steam-pin",
                        start: "top top",
                        end: () => "+=" + distance(),
                        pin: true,
                        scrub: 1,
                        anticipatePin: 1,
                        // This pin sits BELOW the work-slides pin on the page, so it
                        // must refresh AFTER it (lower priority). Without this, it is
                        // measured before the slides pin reserves its scroll space and
                        // engages far too early — bleeding over the books section.
                        refreshPriority: 0,
                        invalidateOnRefresh: true,
                        onUpdate: self => {
                            if (bar) bar.style.width = (self.progress * 100) + "%";
                            if (count) count.textContent =
                                String(Math.min(total, Math.round(self.progress * (total - 1)) + 1)).padStart(2, '0')
                                + ' / ' + String(total).padStart(2, '0');
                        }
                    }
                });
            }
        }

        // Section Dividers — animate ALL (NOW READING + NOW PLAYING)
        gsap.utils.toArray('.section-divider').forEach(divider => {
            const lineLeft  = divider.querySelector('.divider-line.left');
            const lineRight = divider.querySelector('.divider-line.right');
            const label     = divider.querySelector('.divider-label');

            gsap.set(lineLeft,  { scaleX: 0, transformOrigin: "left center" });
            gsap.set(lineRight, { scaleX: 0, transformOrigin: "right center" });
            gsap.set(label,     { opacity: 0, letterSpacing: "20px" });

            ScrollTrigger.create({
                trigger: divider,
                start: "top 90%",
                once: true,
                onEnter: () => {
                    gsap.to(lineLeft,  { scaleX: 1, duration: 1.2, ease: "expo.inOut" });
                    gsap.to(lineRight, { scaleX: 1, duration: 1.2, ease: "expo.inOut", delay: 0.05 });
                    gsap.to(label,     { opacity: 1, letterSpacing: "8px", duration: 0.8, ease: "power3.out", delay: 0.5 });
                }
            });
        });

        // GALLERY: Title zooms in; items rise up
        gsap.set(".gallery-section .section-title", { opacity: 0, scale: 1.8 });
        gsap.to(".gallery-section .section-title", {
            scrollTrigger: { trigger: ".gallery-section", start: "top 80%", once: true },
            scale: 1, opacity: 1, duration: 0.9, ease: "power3.out"
        });
        gsap.utils.toArray(".gallery-item").forEach((item, i) => {
            gsap.set(item, { opacity: 0, y: 60 });
            gsap.to(item, {
                scrollTrigger: { trigger: item, start: "top 88%", once: true },
                opacity: 1, y: 0,
                duration: 0.8, delay: i * 0.1, ease: "power3.out"
            });
        });

        // CONTACT: Huge text wipes out from centre; button springs; links stagger
        gsap.set(".huge-text", { opacity: 0, clipPath: "inset(0 50% 0 50%)" });
        gsap.to(".huge-text", {
            scrollTrigger: { trigger: ".contact-section", start: "top 70%", once: true },
            clipPath: "inset(0 0% 0 0%)", opacity: 1,
            duration: 1.2, ease: "power4.out"
        });
        gsap.set(".magnetic-btn", { opacity: 0, scale: 0 });
        gsap.to(".magnetic-btn", {
            scrollTrigger: { trigger: ".contact-section", start: "top 65%", once: true },
            scale: 1, opacity: 1,
            duration: 0.8, delay: 0.3, ease: "back.out(1.7)"
        });
        gsap.utils.toArray(".social-links a").forEach((link, i) => {
            gsap.set(link, { opacity: 0, y: 30 });
            gsap.to(link, {
                scrollTrigger: { trigger: ".social-links", start: "top 85%", once: true },
                y: 0, opacity: 1,
                duration: 0.6, delay: i * 0.1, ease: "power3.out"
            });
        });

        // Center Focus Slides
        const slides = gsap.utils.toArray('.slide');
        if (slides.length > 0) {
            gsap.set(slides, { zIndex: (i, target, targets) => targets.length - i });
            
            const tl = gsap.timeline({
                scrollTrigger: {
                    trigger: ".center-focus-section",
                    start: "top top",
                    end: "+=" + (slides.length * 40) + "%",
                    pin: true,
                    scrub: 1,
                    // Topmost pin on the page → must refresh FIRST so the games pin
                    // below it measures against the scroll space this one reserves.
                    refreshPriority: 1,
                }
            });

            slides.forEach((slide, i) => {
                // Internal image parallax
                const bg = slide.querySelector('.slide-bg');
                if(bg) {
                    gsap.to(bg, {
                        yPercent: -20,
                        ease: "none",
                        scrollTrigger: {
                            trigger: ".center-focus-section",
                            start: "top top",
                            end: "+=" + (slides.length * 100) + "%",
                            scrub: true
                        }
                    });
                }

                if (i < slides.length - 1) {
                    tl.to(slide, {
                        clipPath: "inset(0 0 100% 0)",
                        ease: "none"
                    }, i);
                }
            });
        }

        // Full Height Parallax
        gsap.utils.toArray('.parallax-image').forEach(image => {
            gsap.to(image, {
                yPercent: 30,
                ease: "none",
                scrollTrigger: {
                    trigger: image.parentElement,
                    start: "top bottom",
                    end: "bottom top",
                    scrub: true
                }
            });
        });

        // All triggers now exist — recompute positions in page order (honouring
        // refreshPriority above), then again once late-loading images/fonts could
        // have shifted layout. Keeps the two pins measured against the final page.
        ScrollTrigger.refresh();
        window.addEventListener('load', () => ScrollTrigger.refresh());
        if (document.fonts && document.fonts.ready) {
            document.fonts.ready.then(() => ScrollTrigger.refresh());
        }
    }

    // --- WebGL Particle Network Graph ---
    const container = document.getElementById('webgl-container');
    if (container && window.THREE) {
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x0a0a0a);
        scene.fog = new THREE.Fog(0x0a0a0a, 10, 50);

        const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
        camera.position.z = 30;

        const renderer = new THREE.WebGLRenderer({ alpha: false, antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        container.appendChild(renderer.domElement);

        // Fewer particles on small screens — the connection check is O(n^2)
        const particleCount = window.innerWidth < 768 ? 60 : 130;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        const velocities = [];

        for (let i = 0; i < particleCount; i++) {
            positions[i * 3] = (Math.random() - 0.5) * 60;
            positions[i * 3 + 1] = (Math.random() - 0.5) * 60;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 30;

            velocities.push({
                x: (Math.random() - 0.5) * 0.05,
                y: (Math.random() - 0.5) * 0.05,
                z: (Math.random() - 0.5) * 0.05
            });
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const material = new THREE.PointsMaterial({
            color: 0x39ff14,
            size: 0.18,
            transparent: true,
            opacity: 0.75
        });

        const particles = new THREE.Points(geometry, material);
        scene.add(particles);

        const lineMaterial = new THREE.LineBasicMaterial({
            color: 0x39ff14,
            transparent: true,
            opacity: 0.12
        });

        // Pre-allocate the line buffer once (worst case: every pair connected),
        // then refill + setDrawRange each frame. No per-frame geometry alloc/dispose.
        const maxPairs = (particleCount * (particleCount - 1)) / 2;
        const linePositions = new Float32Array(maxPairs * 6);
        const lineGeometry = new THREE.BufferGeometry();
        lineGeometry.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
        const linesMesh = new THREE.LineSegments(lineGeometry, lineMaterial);
        scene.add(linesMesh);

        const posArray = geometry.attributes.position.array;
        const lineAttr = lineGeometry.attributes.position;

        function renderFrame() {
            for (let i = 0; i < particleCount; i++) {
                posArray[i * 3] += velocities[i].x;
                posArray[i * 3 + 1] += velocities[i].y;
                posArray[i * 3 + 2] += velocities[i].z;

                if (Math.abs(posArray[i * 3]) > 30) velocities[i].x *= -1;
                if (Math.abs(posArray[i * 3 + 1]) > 30) velocities[i].y *= -1;
                if (Math.abs(posArray[i * 3 + 2]) > 15) velocities[i].z *= -1;
            }
            geometry.attributes.position.needsUpdate = true;

            let v = 0;
            for (let i = 0; i < particleCount; i++) {
                for (let j = i + 1; j < particleCount; j++) {
                    const dx = posArray[i * 3] - posArray[j * 3];
                    const dy = posArray[i * 3 + 1] - posArray[j * 3 + 1];
                    const dz = posArray[i * 3 + 2] - posArray[j * 3 + 2];
                    if (dx * dx + dy * dy + dz * dz < 45) {
                        linePositions[v++] = posArray[i * 3];
                        linePositions[v++] = posArray[i * 3 + 1];
                        linePositions[v++] = posArray[i * 3 + 2];
                        linePositions[v++] = posArray[j * 3];
                        linePositions[v++] = posArray[j * 3 + 1];
                        linePositions[v++] = posArray[j * 3 + 2];
                    }
                }
            }
            lineGeometry.setDrawRange(0, v / 3);
            lineAttr.updateRange.count = v;
            lineAttr.needsUpdate = true;

            camera.position.x = Math.sin(Date.now() * 0.0002) * 5;
            camera.position.y = Math.cos(Date.now() * 0.0002) * 5;
            camera.lookAt(0, 0, 0);

            renderer.render(scene, camera);
        }

        // Pause the render loop when the tab isn't visible (saves CPU / battery)
        let rafId = null;
        function loop() {
            renderFrame();
            rafId = requestAnimationFrame(loop);
        }
        function start() { if (rafId === null && !prefersReduced) rafId = requestAnimationFrame(loop); }
        function stop() { if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; } }

        document.addEventListener('visibilitychange', () => {
            if (document.hidden) stop(); else start();
        });

        if (prefersReduced) {
            renderFrame(); // single static frame, no animation loop
        } else {
            start();
        }

        window.addEventListener('resize', () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }
});
