import express from 'express';
import bodyParser from 'body-parser';
import { exec } from 'child_process';

const app = express();
const PORT = 9000;

app.use(bodyParser.json());

app.post('/webhook', (req, res) => {
  const payload = req.body;

  if (payload.ref === 'refs/heads/main') {
    console.log('Pulling latest code from GitHub...');
    exec('cd /opt/studySpaces && git pull origin main && npm ci && npm run build && pm2 restart studySpaces', (err, stdout, stderr) => {
      if (err) {
        console.error(`❌ Error:\n${stderr}`);
        return res.status(500).send('Pull failed');
      }
      console.log(`Success:\n${stdout}`);
      res.status(200).send('Deployed!');
    });
  } else {
    res.status(200).send('Not main branch');
  }
});

app.listen(PORT, () => {
  console.log(`Webhook server listening on port ${PORT}`);
});
