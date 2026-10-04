/** Site-wide footer: GitHub repo link in the bottom-left corner, author credit. */
export default function SiteFooter() {
  return (
    <footer className="border-t border-gray-200 bg-white">
      <div className="container mx-auto flex items-center gap-4 px-4 py-6">
        <a
          href="https://github.com/gv1shnu/world-of-books"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Source code on GitHub"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-gray-700 transition hover:bg-gray-100 hover:text-gray-900"
        >
          <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true">
            <path d="M12 .5C5.65.5.5 5.65.5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-2.17c-3.2.7-3.88-1.36-3.88-1.36-.52-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a10.9 10.9 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.42-2.7 5.4-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
          </svg>
        </a>
        <p className="text-sm text-gray-700">
          Built by{' '}
          <a
            href="https://vishnugandarapu.in"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block py-1 font-semibold text-emerald-800 underline underline-offset-2 hover:text-emerald-900"
          >
            Vishnu Gandarapu
          </a>
        </p>
      </div>
    </footer>
  );
}
