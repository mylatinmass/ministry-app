const toNetlifyEvent = (req) => {
  const body =
    typeof req.body === "string"
      ? req.body
      : req.body
      ? JSON.stringify(req.body)
      : ""

  return {
    body,
    headers: req.headers || {},
    httpMethod: req.method,
    queryStringParameters: req.query || {},
    isBase64Encoded: false,
  }
}

const sendGatsbyResponse = (res, response) => {
  const headers = response.headers || {}

  Object.entries(headers).forEach(([key, value]) => {
    res.setHeader(key, value)
  })

  res.status(response.statusCode || 200).send(response.body || "")
}

const createGatsbyHandler = (handler) => async (req, res) => {
  const response = await handler(toNetlifyEvent(req))
  sendGatsbyResponse(res, response)
}

module.exports = {
  createGatsbyHandler,
}
