function createError(statusCode, message) {
  const err = new Error(message || 'An unexpected error occurred');
  err.status = statusCode;
  err.statusCode = statusCode;
  return err;
}

module.exports = createError;
