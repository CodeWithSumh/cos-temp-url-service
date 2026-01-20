const express = require('express');
const cors = require('cors');
const COS = require('cos-nodejs-sdk-v5');
const request = require('request');
const fetch = require('node-fetch');

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

    /**
     * 1️⃣ 获取 COS 临时下载 URL（你原本就有）
     */
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

    /**
     * 2️⃣ 透传 Range（GaussianSplats3D 必须）
     */
    const headers = {};
    if (req.headers.range) {
      headers.range = req.headers.range;
    }

    /**
     * 3️⃣ 从 COS 拉数据
     */
    const cosResp = await fetch(cosUrl, { headers });

    /**
     * 4️⃣ 设置必要响应头
     */
    res.status(cosResp.status);
    res.set({
      'Content-Type': 'application/octet-stream',
      'Accept-Ranges': 'bytes',
      'Content-Length': cosResp.headers.get('content-length'),
      'Content-Range': cosResp.headers.get('content-range')
    });

    /**
     * 5️⃣ 流式返回（140MB 没压力）
     */
    cosResp.body.pipe(res);

  } catch (err) {
    console.error('splat proxy error:', err);
    res.status(500).send('internal error');
  }
});

initCos();

app.listen(port, () => {
  console.log(`splat proxy running on port ${port}`);
});
