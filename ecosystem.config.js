module.exports = {
  apps: [
    {
      name: "API-SRP-Sintecrom",
      script: "server.js",
      watch: true,
      env: {
        NODE_ENV: "development",
        PORT: 3001,
      },
      env_production: {
        NODE_ENV: "production",
        PORT: 3001,
      },
    },
  ],
};
