module.exports = ({ env }) => ({
    connection: env('DATABASE_CLIENT') === 'sqlite'
      ? {
        client: 'sqlite',
        connection: {
          filename: env('DATABASE_FILENAME', '.tmp/data.db'),
        },
        debug: false,
        useNullAsDefault: true,
        pool: { min: 0, max: 1 },
        acquireConnectionTimeout: 5000,
      }
      : {
        client: 'postgres',
        connection: {
          connectionString: env('DATABASE_URL')
        },
        debug: false,
        pool: { min: 0, max: 7 },
      },
});
