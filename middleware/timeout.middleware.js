export const timeoutMiddleware = (req, res, next) => {
    if (req.originalUrl.includes('/upload-media')) {
    return next();
  }
  // Set a timeout for 30 seconds
  const timeout = setTimeout(() => {
    console.log(`Request to ${req.originalUrl} timed out`);
    res.status(408).json({
      success: false,
      message: 'Request timeout'
    });
  }, 30000);
  
  // Clear the timeout when the response is sent
  res.on('finish', () => {
    clearTimeout(timeout);
  });
  
  next();
};