module.exports = {
  apps: [{
    name: "aspace-backend",
    script: "./app.js",
    watch: true,
    env: { //default environment (if no pm2 env argument is set)
      "NODE_ENV": "development",
      "PORT": 3001,
    }, //production environment
    env_prod: {
      "PORT": 3000,
      "NODE_ENV": "production",
    }, //development environment
    env_dev: {
      "PORT": 3001,
      "NODE_ENV": "development"
    }
  }]
}