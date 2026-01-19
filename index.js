const express = require('express')
const COS = require('cos-nodejs-sdk-v5')
const request = require('request')

const app = express()
const port = process.env.PORT || 3000

let cos = null

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

  console.log('COS 初始化完成')
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
