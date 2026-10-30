import { createModelImageResolver } from './car-images';
const supplied = [
  ['ferrari', '488gtb', 'Ferrari/Ferrari%20488%20GTB.png'],
  ['ferrari', '488pista', 'Ferrari/Ferrari%20488%20pista.png'],
  ['haval', 'dargo', 'Haval/Dargon.png'],
  ['haval', 'jolion', 'Haval/jolion.png'],
  ['haval', 'h2', 'Haval/H2.png'],
  ['honda', 'accord', 'Honda/accord.png'],
  ['toyota', '4runner', 'Toyota/4runner.png'],
  ['toyota', 'camry', 'Toyota/camry.png'],
  ['toyota', 'agya', 'Toyota/Agya.png'],
  ['toyota', 'alphard', 'Toyota/alphard.png'],
].map(([brandId, model, file]) => ({
  brandId,
  model,
  year: null,
  url: 'assets/List_Car/' + file + '?v=0123456789ab',
}));
const modelImage = createModelImageResolver(supplied);
const localFile = (url: string | null) => url?.split('?')[0] ?? null;
describe('Local car image matching', () => {
  it('leaves models without a supplied image empty', () => {
    expect(modelImage('honda', 'Civic')).toBeNull();
    expect(modelImage('honda', 'Accord')).toContain('assets/List_Car/Honda/accord.png');
  });
  it('matches exact brands and models without confusing similar names', () => {
    expect(localFile(modelImage('ferrari', '488 GTB'))).toBe(
      'assets/List_Car/Ferrari/Ferrari%20488%20GTB.png',
    );
    expect(localFile(modelImage('ferrari', '488 Pista'))).toBe(
      'assets/List_Car/Ferrari/Ferrari%20488%20pista.png',
    );
    expect(modelImage('ferrari', '488')).toBeNull();
    expect(modelImage('ferrari', 'F80')).toBeNull();
    expect(localFile(modelImage('haval', 'Dargo'))).toBe('assets/List_Car/Haval/Dargon.png');
    expect(localFile(modelImage('haval', 'Jolion'))).toBe('assets/List_Car/Haval/jolion.png');
    expect(modelImage('honda', 'Camry')).toBeNull();
  });
  it('uses the updated model-level files instead of removed year-specific images', () => {
    expect(localFile(modelImage('honda', 'Accord'))).toBe('assets/List_Car/Honda/accord.png');
    expect(localFile(modelImage('toyota', '4Runner'))).toBe('assets/List_Car/Toyota/4runner.png');
    expect(localFile(modelImage('toyota', 'Camry'))).toBe('assets/List_Car/Toyota/camry.png');
    expect(localFile(modelImage('toyota', 'Agya'))).toBe('assets/List_Car/Toyota/Agya.png');
    expect(localFile(modelImage('toyota', 'Alphard'))).toBe('assets/List_Car/Toyota/alphard.png');
    expect(
      modelImage('honda', 'Accord', { name: 'Accord Coupe (2020)', yearStart: 2020 }),
    ).toBeNull();
  });
  it('versions image URLs by content so replaced files do not reuse an old browser cache', () => {
    expect(modelImage('honda', 'Accord')).toMatch(/accord\.png\?v=[a-f0-9]{12}$/);
    expect(modelImage('haval', 'H2')).toMatch(/H2\.png\?v=[a-f0-9]{12}$/);
  });
});
