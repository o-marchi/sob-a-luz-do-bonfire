module.exports = ({ env }) => ({
    connection: env('DATABASE_CLIENT') === 'sqlite'
      ? {
        client: 'sqlite',
        connection: {
          filename: env('DATABASE_FILENAME', '.tmp/data.db'),
        },
        debug: true,
        pool: { min: 0, max: 7 },
      }
      : {
        client: 'postgres',
        connection: {
          connectionString: env('DATABASE_URL')
        },
        debug: true,
        pool: { min: 0, max: 7 },
      },
});
