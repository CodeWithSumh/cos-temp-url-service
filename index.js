const express = require('express')
const COS = require('cos-nodejs-sdk-v5')

const app = express()
const port = process.env.PORT || 3000

// 通过环境变量注入（云托管里配置）
const cos = new COS({
  SecretId: process.env.COS_SECRET_ID,
  SecretKey: process.env.COS_SECRET_KEY,
})

const BUCKET = process.env.COS_BUCKET
const REGION = process.env.COS_REGION

/**
 * GET /api/getTempUrl?key=models/demo.splat
 */
app.get('/api/getTempUrl', (req, res) => {
  const { key } = req.query

  if (!key) {
    return res.status(400).json({ error: 'missing key' })
  }

  cos.getObjectUrl(
    {
      Bucket: BUCKET,
      Region: REGION,
      Key: key,
      Sign: true,
      Expires: 60 * 10 // 10 分钟
    },
    (err, data) => {
      if (err) {
        console.error(err)
        return res.status(500).json({ error: 'cos error' })
      }

      res.json({
        url: data.Url
      })
    }
  )
})

app.listen(port, () => {
  console.log(`server running on ${port}`)
})
