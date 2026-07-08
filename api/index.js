/* Vercel serverless entrypoint — re-exports the Express app.
   Every request not served as a static file (see vercel.json) is
   routed here. */
module.exports = require('../server');
