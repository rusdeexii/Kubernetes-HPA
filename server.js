'use strict';
const express = require('express');
const PORT = 8080;
const HOST = '0.0.0.0';
const app = express();


function calculateCPUIntensiveTask() {
  let i;
  for (let z = 0; z < getRandomInt(9999999); z++) {
    i = Math.sqrt(getRandomInt(9999999)).toString();
  }
  return i;
}


app.get('/', (req, res) => {
  const result = calculateCPUIntensiveTask();
  console.log(result);
  res.send(result);
});


app.get('/healthz', (req, res) => {
  res.send({ status: "UP" });
});


function getRandomInt(max) {
  return Math.floor(Math.random() * Math.floor(max));
}

app.listen(PORT, HOST);
console.log(`Running on http://${HOST}:${PORT}`);
