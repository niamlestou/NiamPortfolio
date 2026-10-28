// Auto-rotates every 6s until the visitor interacts (click, key, hover or focus), then stays put.
    (() => {
        const root = document.querySelector('.gp');
        const slides = [...root.querySelectorAll('.gp-slide')], dots = [...root.querySelectorAll('.gp-dot')];
        const h = root.querySelector('.gp-cap h3'), p = root.querySelector('.gp-cap p');
        let i = 0, timer = setInterval(() => show(i + 1), 6000);
        const stop = () => { clearInterval(timer); timer = null; };
        function show(n) {
            i = (n + slides.length) % slides.length;
            slides.forEach((s, k) => s.classList.toggle('on', k === i));
            dots.forEach((d, k) => k === i ? d.setAttribute('aria-current', 'true') : d.removeAttribute('aria-current'));
            h.textContent = slides[i].dataset.title; p.textContent = slides[i].dataset.desc;
        }
        root.querySelector('.gp-prev').onclick = () => { stop(); show(i - 1); };
        root.querySelector('.gp-next').onclick = () => { stop(); show(i + 1); };
        dots.forEach((d, k) => d.onclick = () => { stop(); show(k); });
        root.addEventListener('keydown', e => { if (e.key === 'ArrowLeft') { stop(); show(i - 1); } if (e.key === 'ArrowRight') { stop(); show(i + 1); } });
        ['mouseenter', 'focusin', 'touchstart'].forEach(ev => root.addEventListener(ev, stop, { passive: true }));
        if (matchMedia('(prefers-reduced-motion: reduce)').matches) stop();
        if (slides.length < 2) { stop(); root.querySelectorAll('.gp-btn, .gp-dots').forEach(e => e.style.display = 'none'); }
        show(0);
    })();

// replaces the old inline onerror handlers (blocked by the CSP): broken screenshots become a placeholder
document.querySelectorAll('.gp-slide img').forEach(img => {
    const fail = () => img.replaceWith(Object.assign(document.createElement('span'), { className: 'gp-ph', textContent: 'Screenshot coming soon' }));
    if (img.complete && img.naturalWidth === 0) fail(); else img.addEventListener('error', fail, { once: true });
});
