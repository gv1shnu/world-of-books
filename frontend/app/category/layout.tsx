import type { Metadata } from 'next';

// The category name is filled in client-side once the data loads.
export const metadata: Metadata = {
  title: 'Category',
  description: 'Second-hand books in this World of Books category, with live prices and stock.',
};

export default function CategoryLayout({ children }: { children: React.ReactNode }) {
  return children;
}
