const fs = require('fs');
const axios = require('axios');

fs.mkdirSync('test');

for (let i = 0; i < 100; i++) {
  writeToFile(`test/large_diff_${i}`);
}


function writeToFile(path) {
    const fileContents = axios.get('https://loripsum.net/api/10/long/headers')
      .then(res => fs.writeFileSync(path, res.data))
      .catch(err => console.log('error ->', err));
} 