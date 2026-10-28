// Project-specific analytics settings, shared by the Node server and the Cloudflare Worker.
// Event names must be listed here to be stored; the beacon (analytics.js) sends exactly these.
export const events = ['link_click', 'scroll_depth', 'video_play', 'video_progress', 'video_watch'];
export const funnel = [
  { label: 'Home', path: '/index.html' },
  { label: 'Projects', path: '/projects.html' },
  { label: 'Contact page', path: '/contact.html' },
  { label: 'Resume or email', event: 'ui_click', eventLabel: 'resume-download' },
];
