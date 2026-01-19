const express = require('express')
const COS = require('cos-nodejs-sdk-v5')

const app = express()
const port = process.env.PORT || 3000

// ❗️这里不传 SecretId / SecretKey
// 微信云托管会自动注入临时凭证
const cos = new COS()

const BUCKET = '7072-prod-6gnlypud73cf4391-1395711158'
const REGION = 'ap-shanghai'

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
      Expires: 600
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

app.listen(port, () => {
  console.log('server running')
})
