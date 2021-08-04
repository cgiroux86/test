const fs = require('fs');
const axios = require('axios');


function execute() {
  if (!fs.existsSync('medium')) fs.mkdirSync('medium');
  const type = process.argv[2];
  for (let i = 0; i < 20; i++) {
    if (type === 'cleanup') removeFile(`medium/medium_diff_${i}.html`);
    else writeToFile(`medium/medium_diff_${i}.html`);
  }
}

async function writeToFile(path) {
  const longFile = '';
  try {
    const arr = Array.from({length: 20}, () => axios.get('https://loripsum.net/api/10/long/headers'));
    const file = await Promise.all(arr)
    fs.writeFileSync(path, file.map(res => res.data).join(''));
  }
  catch(err) {
    console.log('ERR ->', err);
  }
} 

function removeFile(path) {
  return fs.unlinkSync(path);
}

execute(); 