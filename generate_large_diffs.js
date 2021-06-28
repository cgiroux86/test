const fs = require('fs');
const axios = require('axios');


function execute() {
  if (!fs.existsSync('large')) fs.mkdirSync('large');
  const type = process.argv[2];
  for (let i = 0; i < 150; i++) {
    if (type === 'cleanup') removeFile(`test/large_diff_${i}`);
    else writeToFile(`test/large_diff_${i}`);
  }
}

function writeToFile(path) {
  return axios.get('https://loripsum.net/api/10/long/headers')
    .then(res => fs.writeFileSync(path, res.data))
    .catch(err => console.log('error ->', err));
} 

function removeFile(path) {
  return fs.unlinkSync(path);
}

execute(); 