(function () {
    var here = location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.menu a').forEach(function (a) {
        if (a.getAttribute('href') === here) a.setAttribute('aria-current', 'page');
    });

    // phones (Compute): the menu folds behind a [ menu ] button; CSS shows it only at <=720px
    var header = document.querySelector('.site-header'), nav = header && header.querySelector('nav');
    if (nav && document.documentElement.dataset.theme !== 'meadow') {
        var btn = document.createElement('button');
        btn.type = 'button'; btn.className = 'nav-toggle'; btn.textContent = '[ menu ]';
        nav.id = nav.id || 'site-nav';
        btn.setAttribute('aria-controls', nav.id); btn.setAttribute('aria-expanded', 'false');
        var set = function (open) {
            header.classList.toggle('menu-open', open);
            btn.setAttribute('aria-expanded', String(open));
            btn.textContent = open ? '[ close ]' : '[ menu ]';
        };
        btn.addEventListener('click', function () { set(!header.classList.contains('menu-open')); });
        document.addEventListener('keydown', function (e) { if (e.key === 'Escape') set(false); });
        nav.before(btn);
        header.classList.add('has-toggle');
    }

    var touch = window.matchMedia('(hover: none)');
    if (!touch.matches) return;

    function closeOthers(except) {
        document.querySelectorAll('.dropdown.dropdown-open').forEach(function (item) {
            if (item !== except) {
                item.classList.remove('dropdown-open');
                item.querySelector('a').setAttribute('aria-expanded', 'false');
            }
        });
    }

    document.querySelectorAll('.dropdown > a').forEach(function (link) {
        link.setAttribute('aria-haspopup', 'true');
        link.setAttribute('aria-expanded', 'false');

        link.addEventListener('click', function (event) {
            var item = link.parentElement;
            if (item.classList.contains('dropdown-open')) return;
            event.preventDefault();
            closeOthers(item);
            item.classList.add('dropdown-open');
            link.setAttribute('aria-expanded', 'true');
        });
    });

    document.addEventListener('click', function (event) {
        if (!event.target.closest('.dropdown')) {
            closeOthers(null);
            if (document.activeElement && document.activeElement.closest('.dropdown')) {
                document.activeElement.blur();
            }
        }
    });
})();
