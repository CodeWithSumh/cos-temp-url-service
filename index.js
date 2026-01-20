const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();

/**
 * ✅ CORS：只允许必要内容
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
 * ✅ 必须显式处理 OPTIONS（非常关键）
 */
app.options('/api/splat', (req, res) => {
  res.sendStatus(204);
});

/**
 * ✅ splat 代理接口
 */
app.get('/api/splat', async (req, res) => {
  try {
    const { key } = req.query;
    if (!key) {
      return res.status(400).send('missing key');
    }

    /**
     * 这里是你生成的 COS 临时 URL
     * 示例用假方法表示
     */
    const cosTempUrl = await getCosTempUrl(key);

    /**
     * 关键：透传 Range
     */
    const headers = {};
    if (req.headers.range) {
      headers.range = req.headers.range;
    }

    const cosResp = await fetch(cosTempUrl, { headers });

    /**
     * 关键：把 COS 的 Range 响应头完整返回
     */
    res.status(cosResp.status);
    res.set({
      'Content-Type': 'application/octet-stream',
      'Accept-Ranges': 'bytes',
      'Content-Length': cosResp.headers.get('content-length'),
      'Content-Range': cosResp.headers.get('content-range')
    });

    cosResp.body.pipe(res);

  } catch (err) {
    console.error(err);
    res.status(500).send('internal error');
  }
});

/**
 * 示例：你已有的临时 URL 获取逻辑
 */
async function getCosTempUrl(key) {
  // 这里换成你已经部署成功的 COS SDK 逻辑
  return `https://example.cos.temp.url/${key}`;
}

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log('splat proxy running on port', port);
});
