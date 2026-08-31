const views = [...document.querySelectorAll('.view')];
const navItems = [...document.querySelectorAll('.nav-item')];
const sidebar = document.querySelector('.sidebar');
const scrim = document.getElementById('scrim');
const menuToggle = document.getElementById('menu-toggle');

function showView(name) {
  views.forEach((view) => view.classList.toggle('is-visible', view.id === `view-${name}`));
  navItems.forEach((item) => {
    const active = item.dataset.view === name;
    item.classList.toggle('is-active', active);
    if (active) item.setAttribute('aria-current', 'page');
    else item.removeAttribute('aria-current');
  });
  closeMenu();
  document.getElementById('main-content').focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function openMenu() {
  sidebar.classList.add('is-open');
  scrim.classList.add('is-visible');
  menuToggle.setAttribute('aria-expanded', 'true');
}

function closeMenu() {
  sidebar.classList.remove('is-open');
  scrim.classList.remove('is-visible');
  menuToggle.setAttribute('aria-expanded', 'false');
}

navItems.forEach((item) => item.addEventListener('click', () => showView(item.dataset.view)));
document.querySelectorAll('[data-view-target]').forEach((item) => item.addEventListener('click', () => showView(item.dataset.viewTarget)));
menuToggle.addEventListener('click', () => sidebar.classList.contains('is-open') ? closeMenu() : openMenu());
scrim.addEventListener('click', closeMenu);

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeMenu();
});

const summary = document.getElementById('summary');
const summaryCount = document.getElementById('summary-count');
summary.addEventListener('input', () => { summaryCount.textContent = `${summary.value.length} / 100`; });

const form = document.getElementById('ticket-form');
const toast = document.getElementById('toast');
let toastTimer;
form.addEventListener('submit', (event) => {
  event.preventDefault();
  toast.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 3400);
});

document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    tab.parentElement.querySelectorAll('.tab').forEach((sibling) => {
      sibling.classList.remove('is-active');
      sibling.setAttribute('aria-selected', 'false');
    });
    tab.classList.add('is-active');
    tab.setAttribute('aria-selected', 'true');
  });
});

document.querySelectorAll('[data-ticket]').forEach((row) => row.addEventListener('click', () => showView('technician')));

document.querySelectorAll('[data-ticket-panel]').forEach((row) => {
  row.addEventListener('click', () => {
    row.parentElement.querySelectorAll('[data-ticket-panel]').forEach((sibling) => sibling.classList.remove('selected'));
    row.classList.add('selected');
  });
});
