const fs = require('fs');
const axios = require('axios');


function execute() {
  if (!fs.existsSync('large')) fs.mkdirSync('large');
  const type = process.argv[2];
  for (let i = 0; i < 150; i++) {
    if (type === 'cleanup') removeFile(`large/large_diff_${i}.html`);
    else writeToFile(`large/large_diff_${i}.html`);
  }
}

function writeToFile(path) {
  let combined;
  return Promise.all([
 axios.get('https://l   oripsum.net/api/10/long/headers'),
    axios.get('https://loripsum.net/api/10/long/headers'),
    axios.get('https://loripsum.net/api/10/long/headers'),
    axios.get('https://loripsum.net/api/10/long/headers'),
    axios.get('https://loripsum.net/api/10/long/headers'),
    axios.get('https://loripsum.net/api/10/long/headers')
  ]).then(([file1, file2, file3, file4, file5, file6]) => {
    combined = file1.data + file2.data + file3.data + file4.data + file5.data + file6.data;
    fs.writeFileSync(`large/huge_file.html`, combined)
  });
  // return 
  //   .then(res => fs.writeFileSync(path, res.data))
  //   .catch(err => console.log('error ->', err));
} 

function removeFile(path) {
  return fs.unlinkSync(path);
}

execute(); 