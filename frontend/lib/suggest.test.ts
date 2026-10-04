import { editDistance, normalize, suggestCategories } from './suggest';

const categories = [
  { slug: 'crime-and-mystery-books', title: 'Crime & Mystery' },
  { slug: 'fantasy-books', title: 'Fantasy' },
  { slug: 'science-fiction-books', title: 'Science Fiction' },
  { slug: 'history-books', title: 'History' },
  { slug: 'horror-books', title: 'Horror' },
];

describe('normalize()', () => {
  it('drops case, punctuation and the books suffix', () => {
    expect(normalize('Crime-and-Mystery-Books')).toBe('crime and mystery');
    expect(normalize('Crime & Mystery')).toBe('crime and mystery');
  });
});

describe('editDistance()', () => {
  it('counts single-character edits', () => {
    expect(editDistance('fantasy', 'fantasy')).toBe(0);
    expect(editDistance('fantsy', 'fantasy')).toBe(1);
    expect(editDistance('histroy', 'history')).toBe(2);
  });
});

describe('suggestCategories()', () => {
  it('confidently corrects a small typo in a slug', () => {
    const result = suggestCategories('crime-and-mystrey-books', categories);
    expect(result.confident).toBe(true);
    expect(result.suggestions[0].slug).toBe('crime-and-mystery-books');
  });

  it('confidently corrects a typo in a title', () => {
    const result = suggestCategories('Fantsy', categories);
    expect(result.confident).toBe(true);
    expect(result.suggestions[0].slug).toBe('fantasy-books');
  });

  it('suggests without auto-correcting when two categories are equally close', () => {
    const result = suggestCategories('hor', categories);
    expect(result.confident).toBe(false);
    expect(result.suggestions.map((c) => c.slug)).toContain('horror-books');
  });

  it('matches a partial name', () => {
    const result = suggestCategories('science', categories);
    expect(result.suggestions[0].slug).toBe('science-fiction-books');
  });

  it('returns nothing for unrelated input', () => {
    expect(suggestCategories('zzzzqqq', categories)).toEqual({ suggestions: [], confident: false });
  });
});
