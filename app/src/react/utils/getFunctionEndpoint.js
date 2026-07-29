const getFunctionEndpoint = (functionName) =>
  `/ministry/api/${functionName
    .toString()
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")}`

export default getFunctionEndpoint
