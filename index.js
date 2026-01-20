const express = require('express')
const COS = require('cos-nodejs-sdk-v5')
const request = require('request')
const cors = require('cors')

const app = express()
const port = process.env.PORT || 3000

let cos = null

/**
 * CORS：只针对“访问你云托管接口的前端页面”
 * 注意：这里与 COS 无关
 */
app.use(cors({
  origin: [
    'https://media-service-217355-6-1395711158.sh.run.tcloudbase.com',
    'https://servicewechat.com'
  ],
  methods: ['GET', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Range'],
  credentials: false
}))

/**
 * 初始化 COS（云托管官方推荐方式）
 * 仅服务端使用
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
            console.error('[COS AUTH] error:', err)
            return
          }

          const info = JSON.parse(body)

          callback({
            TmpSecretId: info.TmpSecretId,
            TmpSecretKey: info.TmpSecretKey,
            SecurityToken: info.Token,
            ExpiredTime: info.ExpiredTime
          })
        }
      )
    }
  })
}

/**
 * ✅ 核心接口：
 * 通过云托管代理 splat 文件
 * - 支持 Range
 * - 同源返回
 * - 彻底规避 CORS
 */
app.get('/api/splat', (req, res) => {
  const { key } = req.query

  if (!key) {
    return res.status(400).send('missing key')
  }

  // 安全兜底：只允许 .splat
  if (!key.endsWith('.splat')) {
    return res.status(403).send('invalid file type')
  }

  const range = req.headers.range

  const cosParams = {
    Bucket: process.env.COS_BUCKET,
    Region: process.env.COS_REGION,
    Key: key
  }

  // 关键：透传 Range（GaussianSplats3D 必需）
  if (range) {
    cosParams.Range = range
  }

  cos.getObject(cosParams, (err, data) => {
    if (err) {
      console.error('[COS getObject error]', err)
      return res.status(500).send('cos error')
    }

    // ---- 必要响应头 ----
    res.setHeader('Content-Type', 'application/octet-stream')
    res.setHeader('Accept-Ranges', 'bytes')

    if (data.ContentLength) {
      res.setHeader('Content-Length', data.ContentLength)
    }

    if (data.ContentRange) {
      // Range 请求必须返回 206
      res.status(206)
      res.setHeader('Content-Range', data.ContentRange)
    }

    // data.Body 可能是 Buffer 或 Stream
    if (Buffer.isBuffer(data.Body)) {
      res.end(data.Body)
    } else {
      data.Body.pipe(res)
    }
  })
})

/**
 * 启动服务
 */
initCos()

app.listen(port, () => {
  console.log(`server running at ${port}`)
})
