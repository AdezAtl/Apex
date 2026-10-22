const http = require('http');

const files = [
  'Road008C_1K-PNG_Color.png',
  'Road008C_1K-PNG_NormalGL.png',
  'Road008C_1K-PNG_Roughness.png',
  'Road008C_1K-PNG_AmbientOcclusion.png',
];

Promise.all(files.map(f => new Promise((resolve) => {
  http.get(`http://localhost:5173/Textures/Road/${f}`, res => {
    console.log(`${f}: ${res.statusCode}`);
    resolve(res.statusCode === 200);
  });
}))).then(results => {
  const allOk = results.every(Boolean);
  console.log('All textures accessible:', allOk);
  process.exit(allOk ? 0 : 1);
});
