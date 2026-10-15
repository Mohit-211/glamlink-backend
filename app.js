
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const httpStatus = require('./src/core/http/status');
const path = require('path');
const app = express();
app.set("trust proxy", 1);
// Express 5 defaults to the simple parser; keep nested query params (a[b]=1) parsed as objects.
app.set("query parser", "extended");

const config = require('./src/core/config/config.js');
const routes = require('./src/routes');
const accessLog = require('./src/core/http/accessLog.js');
const { authLimiter } = require('./src/core/http/rateLimiter.js');
const corsConfigs = require('./src/core/http/corsConfigs.js');
const credentials = require('./src/core/http/credentials.js');

const ApiError = require('./src/core/http/ApiError.js');
const errorHandler = require('./src/core/http/errorHandler.js');
require('./src/models');
require('./src/integrations/firebase.js');
const { UPLOADS_DIR } = require('./src/core/config/paths');


const handleFileUploads = require('./src/core/http/uploads.js');
const jobs = require('./src/jobs');




// Scheduled jobs (not under test: they change data on their own clock). Each module declares its own.
if (config.env !== 'test') {
  jobs.start();
}

// set security HTTP headers
app.use(
	helmet.contentSecurityPolicy({
		useDefaults: true,
		directives: {
			'img-src': ["'self' data:", '*.google-analytics.com', '*.vimeocdn.com'],
			'script-src': ["'self'", "'unsafe-eval'", "'unsafe-inline'"],
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
// Express 5 leaves req.body undefined when no parser ran (e.g. GET); middleware and handlers expect an object.
app.use((req, res, next) => {
  req.body ??= {};
  next();
});


// gzip compression
app.use(compression());

if (config.env !== 'test') {
  app.use(accessLog);
};


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


// Limit repeated attempts on admin sign-in (user sign-in limits its own routes: src/modules/identity/auth.route.js)
if (config.env === 'production') {
  app.use('/api/v1/admin/auth', authLimiter);
};

app.get('/api/healthcheck', function (req, res) {
  let data = {
    response: 'ok'
  };
  res.status(200).send(data);
});



// Added multer with all v1 api routes
app.use('/api/v1', handleFileUploads, routes);


// Uploaded files. Stored URLs look like <API_BASE_URL>/images/<file>, so keep these paths stable.
['images', 'videos', 'gifs', 'docs', 'audios', 'csv'].forEach((folder) => {
  app.use(`/${folder}`, express.static(path.join(UPLOADS_DIR, folder)));
});

// send back a 404 error for any unknown api request
app.use((req, res, next) => {
  next(new ApiError(httpStatus.NOT_FOUND, 'Not found'));
});

// error handling
app.use(errorHandler);

module.exports = app;

