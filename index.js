const express = require('express')
const COS = require('cos-nodejs-sdk-v5')
const request = require('request')
const cors = require('cors')

const app = express()
const port = process.env.PORT || 3000

let cos = null

// ✅ CORS 配置（重点）
app.use(cors({
  origin: [
    'https://media-service-217355-6-1395711158.sh.run.tcloudbase.com',   // 你的 Vue2 页面域名
    'https://servicewechat.com'    // 小程序 WebView 常用
  ],
  methods: ['GET'],
  allowedHeaders: ['Content-Type'],
  credentials: false
}))

/**
 * 初始化 COS（服务启动时执行一次）
 */
async function initCos() {
  cos = new COS({
    getAuthorization: function (options, callback) {
      request(
        {
          url: 'http://api.weixin.qq.com/_/cos/getauth',
          method: 'GET'
        },
        function (err, response, body) {
          if (err) {
            console.error('getauth error', err)
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
 * 示例接口：返回一个对象的临时访问 URL
 */
app.get('/api/getTempUrl', (req, res) => {
  const { key } = req.query

  if (!key) {
    return res.status(400).json({ error: 'missing key' })
  }

  cos.getObjectUrl(
    {
      Bucket: process.env.COS_BUCKET,
      Region: process.env.COS_REGION,
      Key: key,
      Sign: true
    },
    (err, data) => {
      if (err) {
        console.error(err)
        return res.status(500).json({ error: 'cos error' })
      }

      res.json({ url: data.Url })
    }
  )
})

initCos()

app.listen(port, () => {
  console.log(`server running at ${port}`)
})
