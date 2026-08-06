import { DataSource } from 'typeorm';
import { NavigableTrailerLinks1785974400000 } from './1785974400000-NavigableTrailerLinks';

describe('NavigableTrailerLinks1785974400000', () => {
  let dataSource: DataSource;

  beforeEach(async () => {
    dataSource = new DataSource({ type: 'sqljs' });
    await dataSource.initialize();
    await dataSource.query(`
      CREATE TABLE "games" (
        "id" integer PRIMARY KEY,
        "title" character varying,
        "steam" character varying,
        "trailer" character varying
      )
    `);
  });

  afterEach(async () => {
    await dataSource.destroy();
  });

  it('repairs Silent Hill f and clears every other cached HLS playlist', async () => {
    await dataSource.query(
      `INSERT INTO "games" ("id", "title", "steam", "trailer") VALUES
       (1, ?, ?, ?),
       (2, ?, ?, ?),
       (3, ?, ?, ?)`,
      [
        'SILENT HILL f',
        'https://store.steampowered.com/app/2947440/',
        'https://cdn.example.com/silent-hill.m3u8?token=old',
        'Another Game',
        'https://store.steampowered.com/app/10/',
        'https://cdn.example.com/another.m3u8',
        'Curated Game',
        'https://store.steampowered.com/app/20/',
        'https://www.youtube.com/watch?v=curated',
      ],
    );

    await new NavigableTrailerLinks1785974400000().up(
      dataSource.createQueryRunner(),
    );

    await expect(
      dataSource.query(`SELECT "id", "trailer" FROM "games" ORDER BY "id"`),
    ).resolves.toEqual([
      {
        id: 1,
        trailer: 'https://www.youtube.com/watch?v=0OqTeE3y1x0',
      },
      { id: 2, trailer: null },
      {
        id: 3,
        trailer: 'https://www.youtube.com/watch?v=curated',
      },
    ]);
  });
});
