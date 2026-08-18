require('dotenv').config();
const { validateEnv } = require('./utils/envValidator');

validateEnv();

const express = require('express');
const webhookRouter = require('./routes/webhook');

const app = express();

// GitHub sends the raw body — we need it untouched to verify the HMAC
// signature, so capture it before express.json() parses it.
app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  })
);

app.get('/', (_req, res) => {
  res.send('pr-review-bot is running');
});

app.use('/webhook', webhookRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`pr-review-bot listening on port ${PORT}`);
});
