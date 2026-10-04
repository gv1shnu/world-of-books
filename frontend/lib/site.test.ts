import { jsonLdScript } from './site';

describe('jsonLdScript()', () => {
  it('escapes "<" so text cannot close the script tag', () => {
    const { __html } = jsonLdScript({ name: 'Evil </script><script>alert(1)</script>' });
    expect(__html).not.toContain('</script>');
    expect(JSON.parse(__html).name).toBe('Evil </script><script>alert(1)</script>');
  });
});
