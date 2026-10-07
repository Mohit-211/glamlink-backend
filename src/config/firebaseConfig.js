const path = require('path');
var admin = require("firebase-admin");

process.env.GOOGLE_APPLICATION_CREDENTIALS = path.join(__dirname, './serviceAccountKey.json');

var serviceAccount = require("./serviceAccountKey.json");
const logger = require('./logger');


admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://glamlink-5585b-default-rtdb.firebaseio.com"
});

const checkFirebaseAuth = async () => {
  try {
    const listUsersResult = await admin.auth().listUsers(1);
    logger.info('Firebase is authenticated successfully.');
  } catch (error) {
    logger.warn('Error authenticating with Firebase:', error);
  }
};

checkFirebaseAuth();
