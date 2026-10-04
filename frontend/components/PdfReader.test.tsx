import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { api } from '@/lib/api';
import PdfReader from './PdfReader';

jest.mock('./PdfCanvasViewer', () => ({ __esModule: true, default: ({ url, title }: { url: string; title: string }) => <div title={`PDF of ${title}`} data-url={url} /> }));

jest.mock('@/lib/api', () => ({ api: { post: jest.fn(), get: jest.fn() } }));
const match = {
    status: 'matched', message: 'A PDF with a similar page count was found.',
    expectedPages: 320, pdfPages: 324, tolerancePages: 16,
    sourceUrl: 'https://example.org/book.pdf', token: 'example-token',
    query: '"Example Book" "Jane Doe" filetype:pdf',
};

beforeEach(() => {
    jest.clearAllMocks();
    URL.createObjectURL = jest.fn().mockReturnValue('blob:validated-pdf');
    URL.revokeObjectURL = jest.fn();
    jest.mocked(api.post).mockResolvedValue({ data: match });
    jest.mocked(api.get).mockResolvedValue({ data: new Blob(['%PDF-1.7']) });
});

it('searches only on click and opens the validated PDF within the page', async () => {
    render(<PdfReader productId={7} title="Example Book" />);
    expect(api.post).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Extract PDF' }));
    expect(screen.getByRole('button', { name: /Searching and checking/ })).toBeDisabled();
    const frame = await screen.findByTitle('PDF of Example Book');
    expect(frame).toHaveAttribute('data-url', 'blob:validated-pdf');
    expect(api.post).toHaveBeenCalledWith('/products/7/pdf/extract', {}, expect.objectContaining({ timeout: 75000 }));
    expect(api.get).toHaveBeenCalledWith('/products/7/pdf/example-token', expect.objectContaining({ responseType: 'blob' }));
    expect(screen.getByText(/Listing: 320 pages/)).toBeInTheDocument();
    expect(screen.getByText('PDF: 324 pages')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Source:/ })).toHaveAttribute('href', match.sourceUrl);
    expect(screen.getByRole('region', { name: 'PDF reader for Example Book' })).toHaveFocus();
});

it.each(['no_match', 'missing_metadata', 'not_configured'])('shows the %s outcome without fetching PDF bytes', async (status) => {
    jest.mocked(api.post).mockResolvedValue({ data: { ...match, status, message: 'No PDF available' } });
    render(<PdfReader productId={7} title="Example Book" />);
    fireEvent.click(screen.getByRole('button', { name: 'Extract PDF' }));
    expect(await screen.findByText('No PDF available')).toBeInTheDocument();
    expect(api.get).not.toHaveBeenCalled();
    expect(screen.queryByTitle('PDF of Example Book')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View the search on Google' })).toHaveAttribute('href', `https://www.google.com/search?q=${encodeURIComponent(match.query)}`);
});

it('reports provider failures and permits retry', async () => {
    jest.mocked(api.post).mockRejectedValueOnce(new Error('provider down'));
    render(<PdfReader productId={7} title="Example Book" />);
    fireEvent.click(screen.getByRole('button', { name: 'Extract PDF' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('PDF search or download failed');
    expect(screen.getByRole('button', { name: 'Extract PDF' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Extract PDF' }));
    expect(await screen.findByTitle('PDF of Example Book')).toBeInTheDocument();
});

it('reports failed or expired reader downloads', async () => {
    jest.mocked(api.get).mockRejectedValueOnce(new Error('expired'));
    render(<PdfReader productId={7} title="Example Book" />);
    fireEvent.click(screen.getByRole('button', { name: 'Extract PDF' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByTitle('PDF of Example Book')).not.toBeInTheDocument();
});

it('releases the blob URL when closing or unmounting the reader', async () => {
    const { unmount } = render(<PdfReader productId={7} title="Example Book" />);
    fireEvent.click(screen.getByRole('button', { name: 'Extract PDF' }));
    await screen.findByTitle('PDF of Example Book');
    fireEvent.click(screen.getByRole('button', { name: 'Close reader' }));
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:validated-pdf');
    expect(screen.queryByTitle('PDF of Example Book')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Extract PDF' }));
    await screen.findByTitle('PDF of Example Book');
    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2);
});

it('aborts outstanding requests when leaving the product page', async () => {
    jest.mocked(api.post).mockReturnValue(new Promise(() => {}));
    const { unmount } = render(<PdfReader productId={7} title="Example Book" />);
    fireEvent.click(screen.getByRole('button', { name: 'Extract PDF' }));
    const signal = jest.mocked(api.post).mock.calls[0][2]?.signal;
    unmount();
    await waitFor(() => expect(signal?.aborted).toBe(true));
});
