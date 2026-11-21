import { filenameFromContentDisposition } from './content-disposition';

describe('filenameFromContentDisposition', () => {
  it('reads plain and quoted filenames', () => {
    expect(filenameFromContentDisposition('attachment; filename="report.xlsx"')).toBe(
      'report.xlsx',
    );
    expect(filenameFromContentDisposition('attachment; filename=report.pdf')).toBe('report.pdf');
  });

  it('prefers the RFC 5987 UTF-8 filename', () => {
    const header = `attachment; filename="fallback.pdf"; filename*=UTF-8''${encodeURIComponent('تقرير المبيعات.pdf')}`;
    expect(filenameFromContentDisposition(header)).toBe('تقرير المبيعات.pdf');
  });

  it('returns null when absent', () => {
    expect(filenameFromContentDisposition(null)).toBeNull();
    expect(filenameFromContentDisposition('inline')).toBeNull();
  });
});
