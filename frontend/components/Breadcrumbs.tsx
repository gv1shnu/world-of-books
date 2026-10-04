import Link from 'next/link';

export interface Crumb {
  label: string;
  href?: string;
}

/** "Home › Category › Book" trail; the last item is the current page. */
export default function Breadcrumbs({ items, light = false }: { items: Crumb[]; light?: boolean }) {
  const linkClass = light
    ? 'text-emerald-100 underline-offset-2 hover:text-white hover:underline'
    : 'text-emerald-800 underline-offset-2 hover:text-emerald-900 hover:underline';
  const textClass = light ? 'text-white' : 'text-gray-800';
  const sepClass = light ? 'text-emerald-200' : 'text-gray-500';

  return (
    <nav aria-label="Breadcrumb" className={`mb-4 text-sm ${light ? 'focus-ring-light' : ''}`}>
      <ol className="flex flex-wrap items-center gap-1">
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <li key={`${item.label}-${i}`} className="flex items-center gap-1">
              {item.href && !last ? (
                <Link href={item.href} className={`inline-block py-1 ${linkClass}`}>
                  {item.label}
                </Link>
              ) : (
                <span aria-current={last ? 'page' : undefined} className={`py-1 font-medium ${textClass}`}>
                  {item.label}
                </span>
              )}
              {!last && <span aria-hidden="true" className={sepClass}>›</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
