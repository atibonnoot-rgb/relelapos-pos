/**
 * Vercel Serverless Function Entry Point for RELELAPOS
 * Forwards all incoming HTTP requests to the core application handler.
 */

try {
  require('dotenv').config();
} catch (e) {}

const handleRequest = require('../server');

module.exports = (req, res) => {
  return handleRequest(req, res);
};
