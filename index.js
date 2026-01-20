const express = require('express');
const cors = require('cors');
const COS = require('cos-nodejs-sdk-v5');
const request = require('request');

const app = express();
const port = process.env.PORT || 3000;

let cos = null;

/**
 * ✅ CORS（只针对你的页面）
 */
app.use(cors({
  origin: [
    'https://media-service-217355-6-1395711158.sh.run.tcloudbase.com'
  ],
  methods: ['GET', 'OPTIONS'],
  allowedHeaders: [
    'Range',
    'Content-Type',
    'Accept'
  ],
  exposedHeaders: [
    'Content-Length',
    'Content-Range',
    'Accept-Ranges'
  ],
  credentials: false
}));

/**
 * ✅ 显式处理预检请求（非常关键）
 */
app.options('/api/splat', (req, res) => {
  res.sendStatus(204);
});

/**
 * ✅ 初始化 COS（你原来的逻辑，未改）
 */
function initCos() {
  cos = new COS({
    getAuthorization: function (options, callback) {
      request(
        {
          url: 'http://api.weixin.qq.com/_/cos/getauth',
          method: 'GET'
        },
        function (err, response, body) {
          if (err) {
            console.error('getauth error', err);
            return;
          }

          const info = JSON.parse(body);

          callback({
            TmpSecretId: info.TmpSecretId,
            TmpSecretKey: info.TmpSecretKey,
            SecurityToken: info.Token,
            ExpiredTime: info.ExpiredTime
          });
        }
      );
    }
  });
}

/**
 * ✅ splat 代理接口（核心）
 */
app.get('/api/splat', async (req, res) => {
  try {
    const { key } = req.query;
    if (!key) {
      return res.status(400).send('missing key');
    }

    // 1️⃣ 获取 COS 签名 URL
    const cosUrl = await new Promise((resolve, reject) => {
      cos.getObjectUrl(
        {
          Bucket: process.env.COS_BUCKET,
          Region: process.env.COS_REGION,
          Key: key,
          Sign: true
        },
        (err, data) => {
          if (err) return reject(err);
          resolve(data.Url);
        }
      );
    });

    // 2️⃣ 透传 Range（关键）
    const headers = {};
    if (req.headers.range) {
      headers.Range = req.headers.range;
    }

    // 3️⃣ 直接用 request 流式代理 COS
    request({
      url: cosUrl,
      method: 'GET',
      headers
    })
      .on('response', cosRes => {
        // 4️⃣ 回写必要响应头
        res.status(cosRes.statusCode);
        res.set({
          'Content-Type': 'application/octet-stream',
          'Accept-Ranges': 'bytes',
          'Content-Length': cosRes.headers['content-length'],
          'Content-Range': cosRes.headers['content-range']
        });
      })
      .on('error', err => {
        console.error('COS stream error:', err);
        res.status(502).send('cos fetch failed');
      })
      // 5️⃣ 管道返回（真正支持 100MB+ splat）
      .pipe(res);

  } catch (err) {
    console.error('splat proxy error:', err);
    res.status(500).send('internal error');
  }
});

initCos();

app.listen(port, () => {
  console.log(`splat proxy running on port ${port}`);
});
