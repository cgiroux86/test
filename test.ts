const _ = require('lodash');

function test() {
  const str = 'A23456'
  do {
    console.log('TRUE');
  } while (/[0-9]/.test(_.parseInt(str[0])));
}

test();