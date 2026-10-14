const path = require('path');
const admin = require('firebase-admin');
const logger = require('./logger');

const keyPath = path.join(__dirname, './serviceAccountKey.json');
const serviceAccount = require(keyPath);

// The committed key file is a placeholder; production drops the real one in place.
// Without a real key, skip Firebase so the app still starts (push and chat are unavailable).
if (!serviceAccount.private_key) {
  logger.warn('Firebase key not configured: push notifications and chat are disabled.');
} else {
  process.env.GOOGLE_APPLICATION_CREDENTIALS = keyPath;

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: 'https://glamlink-5585b-default-rtdb.firebaseio.com',
  });

  admin
    .auth()
    .listUsers(1)
    .then(() => logger.info('Firebase is authenticated successfully.'))
    .catch((error) => logger.warn('Error authenticating with Firebase:', error));
}
