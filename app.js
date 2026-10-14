
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const httpStatus = require('http-status');
const cron = require('node-cron');
const path = require('path');
const app = express();
app.set("trust proxy", 1);

const config = require('./src/config/config.js');
const routes = require('./src/routes/v1');
const morgan = require('./src/config/morgan.js');
const { authLimiter } = require('./src/middlewares/rateLimiter.js');
const corsConfigs = require('./src/config/corsConfigs.js');
const credentials = require('./src/middlewares/credentials.js');

const ApiError = require('./src/utils/ApiError.js');
const errorHandler = require('./src/utils/errorHandler.js');
require('./src/models');
require('./src/config/firebaseConfig.js');
const PUBLIC_DIR = path.resolve(__dirname, './public');


const handleFileUploads = require('./src/config/multer.js');
const { checkUserPremiumStatus, checkUserFreeTrialStatus } = require('./src/controllers/Common/crmPayment.controller.js');
const { updateUserPromotions } = require('./src/services/Common/promotion.service.js');




cron.schedule('* * * * *', () => {
  checkUserFreeTrialStatus();
	checkUserPremiumStatus();

});

cron.schedule("1 0 * * *", async () => {
  await updateUserPromotions();
});

// set security HTTP headers
app.use(
	helmet.contentSecurityPolicy({
		useDefaults: true,
		directives: {
			'img-src': ["'self' data:", '*.google-analytics.com', '*.vimeocdn.com'],
			'script-src': ["'self'", '*.polyfill.io', "'unsafe-eval'", "'unsafe-inline'"],
			'default-src': ["'self'", '*.google-analytics.com', '*.gstatic.com', '*.googleapis.com', 'vimeo.com', '*.vimeo.com']
		}
	})
);




// parse json request body

app.use(
  '/api/v1/payment/stripe/charge-intent/webhooks',
  express.raw({ type: '*/*' })
);
app.use(express.json());
// parse urlencoded request body
app.use(express.urlencoded({ extended: true }));


// gzip compression
app.use(compression());

if (config.env !== 'test') {
  app.use(morgan.successHandler);
  app.use(morgan.errorHandler);
};

app.use(express.static(PUBLIC_DIR));

process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 1;


app.use(function (req, res, next) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.removeHeader("Cross-Origin-Embedder-Policy");
  next();
});

app.use(credentials);
app.use(cors(corsConfigs));


// limit repeated failed requests to auth endpoints
if (config.env === 'production') {
  app.use(['/api/v1/user/auth', '/api/v1/admin/auth'], authLimiter);
};

app.get('/api/healthcheck', function (req, res) {
  let data = {
    response: 'ok'
  };
  res.status(200).send(data);
});



// Added multer with all v1 api routes
app.use('/api/v1', handleFileUploads, routes);


// All File Apis
app.use('/images', express.static(`${PUBLIC_DIR}/uploads/images`));
app.use('/videos', express.static(`${PUBLIC_DIR}/uploads/videos`));
app.use('/gifs', express.static(`${PUBLIC_DIR}/uploads/gifs`));
app.use('/docs', express.static(`${PUBLIC_DIR}/uploads/docs`));
app.use('/audios', express.static(`${PUBLIC_DIR}/uploads/audios`));
app.use('/csv', express.static(`${PUBLIC_DIR}/uploads/csv`));

// send back a 404 error for any unknown api request
app.use((req, res, next) => {
  next(new ApiError(httpStatus.NOT_FOUND, 'Not found'));
});

// error handling
app.use(errorHandler);

module.exports = app;

