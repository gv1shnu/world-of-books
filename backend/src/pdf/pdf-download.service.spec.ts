import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { lookup } from 'node:dns/promises';
import { request } from 'node:https';
import {
  isPublicAddress,
  MAX_PDF_BYTES,
  PdfDownloadService,
} from './pdf-download.service';

jest.mock('node:dns/promises', () => ({ lookup: jest.fn() }));
jest.mock('node:https', () => ({ request: jest.fn() }));

describe('PdfDownloadService', () => {
  const service = new PdfDownloadService();
  const body = Buffer.from('%PDF-1.7\nfixture');
  const requestMock = jest.mocked(request);
  const dns = jest.mocked(lookup);
  let socket: EventEmitter & { end: jest.Mock; destroy: jest.Mock };

  function respond(statusCode = 200, headers = {}, chunks = [body]) {
    requestMock.mockImplementationOnce(((_url, _options, callback) => {
      socket = Object.assign(new EventEmitter(), {
        end: jest.fn(() => {
          const response = Object.assign(new PassThrough(), {
            statusCode,
            headers,
          });
          callback(response);
          for (const chunk of chunks)
            if (!response.destroyed) response.write(chunk);
          if (!response.destroyed) response.end();
          socket.emit('close');
        }),
        destroy: jest.fn((error) => {
          socket.emit('error', error);
          socket.emit('close');
        }),
      });
      return socket;
    }) as never);
  }
  beforeEach(() => {
    jest.clearAllMocks();
    dns.mockResolvedValue([{ address: '93.184.216.34', family: 4 }] as never);
  });
  afterEach(() => jest.useRealTimers());

  it.each([
    '127.0.0.1',
    '10.1.1.1',
    '172.16.0.1',
    '192.168.0.1',
    '169.254.169.254',
    '0.0.0.0',
    '100.64.0.1',
    '224.0.0.1',
    '::1',
    'fe80::1',
    'fc00::1',
    '::ffff:127.0.0.1',
    '2001:db8::1',
  ])('rejects reserved address %s', (ip) => {
    expect(isPublicAddress(ip)).toBe(false);
  });
  it('allows public IPv4 and IPv6', () => {
    expect(isPublicAddress('93.184.216.34')).toBe(true);
    expect(isPublicAddress('2606:4700:4700::1111')).toBe(true);
  });
  it.each([
    'file:///tmp/book.pdf',
    'http://example.org/book.pdf',
    'https://user:pass@example.org/book.pdf',
    'https://example.org:8443/book.pdf',
  ])('rejects unsupported URLs before connecting: %s', async (url) => {
    await expect(service.download(url)).rejects.toThrow();
    expect(requestMock).not.toHaveBeenCalled();
  });
  it('pins the validated DNS address to the socket and returns exact bytes', async () => {
    respond();
    expect(await service.download('https://example.org/book.pdf')).toEqual({
      bytes: body,
      url: 'https://example.org/book.pdf',
    });
    const options = requestMock.mock.calls[0][1] as {
      lookup: (
        host: string,
        options: object,
        callback: (error: null, address: string, family: number) => void,
      ) => void;
    };
    const callback = jest.fn();
    options.lookup('example.org', {}, callback);
    expect(callback).toHaveBeenCalledWith(null, '93.184.216.34', 4);
  });
  it('blocks mixed public/private DNS answers', async () => {
    dns.mockResolvedValueOnce([
      { address: '93.184.216.34', family: 4 },
      { address: '10.0.0.1', family: 4 },
    ] as never);
    await expect(
      service.download('https://example.org/book.pdf'),
    ).rejects.toThrow('non-public');
    expect(requestMock).not.toHaveBeenCalled();
  });
  it('rechecks DNS before following a redirect to an internal host', async () => {
    respond(302, { location: 'https://internal.example/book.pdf' });
    dns
      .mockResolvedValueOnce([{ address: '93.184.216.34', family: 4 }] as never)
      .mockResolvedValueOnce([
        { address: '169.254.169.254', family: 4 },
      ] as never);
    await expect(
      service.download('https://example.org/book.pdf'),
    ).rejects.toThrow('non-public');
    expect(requestMock).toHaveBeenCalledTimes(1);
  });
  it('supports relative redirects', async () => {
    respond(302, { location: '/actual.pdf' });
    respond();
    expect(await service.download('https://example.org/book.pdf')).toEqual({
      bytes: body,
      url: 'https://example.org/actual.pdf',
    });
  });
  it('rejects downgrade redirects', async () => {
    respond(302, { location: 'http://example.org/book.pdf' });
    await expect(
      service.download('https://example.org/book.pdf'),
    ).rejects.toThrow('HTTPS');
  });
  it('bounds redirect chains', async () => {
    for (let i = 0; i < 4; i++) respond(302, { location: '/again.pdf' });
    await expect(
      service.download('https://example.org/book.pdf'),
    ).rejects.toThrow('Too many');
    expect(requestMock).toHaveBeenCalledTimes(4);
  });
  it('rejects HTML even if the URL ends in .pdf', async () => {
    respond(200, {}, [Buffer.from('<html>Access denied</html>')]);
    await expect(
      service.download('https://example.org/book.pdf'),
    ).rejects.toThrow('not a PDF');
  });
  it('rejects advertised oversized downloads', async () => {
    respond(200, { 'content-length': String(MAX_PDF_BYTES + 1) });
    await expect(
      service.download('https://example.org/book.pdf'),
    ).rejects.toThrow('too large');
  });
  it('enforces the byte cap even without content-length', async () => {
    respond(200, {}, [body, Buffer.alloc(MAX_PDF_BYTES)]);
    await expect(
      service.download('https://example.org/book.pdf'),
    ).rejects.toThrow('20 MiB');
  });
  it('ends stalled requests after eight seconds', async () => {
    jest.useFakeTimers();
    requestMock.mockImplementationOnce((() => {
      socket = Object.assign(new EventEmitter(), {
        end: jest.fn(),
        destroy: jest.fn((error) => {
          socket.emit('error', error);
          socket.emit('close');
        }),
      });
      return socket;
    }) as never);
    const work = service.download('https://example.org/book.pdf');
    const check = expect(work).rejects.toThrow('timed out');
    await jest.advanceTimersByTimeAsync(8001);
    await check;
  });
});
