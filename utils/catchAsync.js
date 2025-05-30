/**
 * Wrapper function to catch async errors
 * @param {Function} fn - Async function to wrap
 * @returns {Function} - Express middleware function
 */


export const catchAsync = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// export const catchAsync = (fn) => {
//   return (req, res, next) => {
// fn(req, res, next).catch(next)
//   }
// }
