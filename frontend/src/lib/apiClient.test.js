import { toYouTubeEmbed } from './apiClient';

describe('toYouTubeEmbed', () => {
  it('normalizes youtube live URLs into an embed URL with player params', () => {
    const embed = toYouTubeEmbed('https://www.youtube.com/live/abc123XYZ89');
    const url = new URL(embed);

    expect(url.origin).toBe('https://www.youtube.com');
    expect(url.pathname).toBe('/embed/abc123XYZ89');
    expect(url.searchParams.get('rel')).toBe('0');
    expect(url.searchParams.get('modestbranding')).toBe('1');
    expect(url.searchParams.get('playsinline')).toBe('1');
    expect(url.searchParams.get('enablejsapi')).toBe('1');
  });

  it('extracts ids from watch and short links', () => {
    expect(new URL(toYouTubeEmbed('https://www.youtube.com/watch?v=abc123XYZ89')).pathname).toBe('/embed/abc123XYZ89');
    expect(new URL(toYouTubeEmbed('https://youtu.be/abc123XYZ89')).pathname).toBe('/embed/abc123XYZ89');
  });
});
