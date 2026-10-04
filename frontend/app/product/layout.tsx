import type { Metadata } from 'next';

// The book title is filled in client-side once the data loads.
export const metadata: Metadata = {
  title: 'Book details',
  description: 'Description, page count, ISBN and live price for a second-hand book from World of Books.',
};

export default function ProductLayout({ children }: { children: React.ReactNode }) {
  return children;
}
