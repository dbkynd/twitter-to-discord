'use strict';

const ids = [];
let reload = false; // eslint-disable-line prefer-const

// Similar to Promise.all except it will not reject if one of the promises rejects
// Instead we will get a null result
function promiseSome(array) {
  return new Promise((resolve, reject) => { // eslint-disable-line no-unused-vars
    // Create an array of the same length as the promise array to hold results
    const results = Array(array.length);
    let num = 0;
    for (let i = 0; i < array.length; i++) {
      Promise.resolve(array[i])
        .then(resolvedResults => {
          results[i] = resolvedResults;
          checkIfDone();
        })
        .catch(() => {
          results[i] = null;
          checkIfDone();
        });
    }

    function checkIfDone() {
      num++;
      if (num >= array.length) resolve(results);
    }
  });
}

module.exports = {
  ids,
  reload,
  promiseSome,
};
