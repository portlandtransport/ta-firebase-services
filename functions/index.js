const admin = require("firebase-admin");

const firebaseConfig = require("./config.json");
const serviceAccount = require("./serviceAccount.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: firebaseConfig.databaseURL,
});

const stops = require("./stops");
const configs = require("./configs");
const applications = require("./applications");
exports.stops = stops.stops;
exports.configsCentral = configs.configs;
exports.applications = applications.applications;
