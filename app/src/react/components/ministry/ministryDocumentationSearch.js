const normalize = (value = "") =>
  value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()

const tokenize = (value) => normalize(value).match(/[a-z0-9]+/g) || []
const questionWords = new Set(["a", "an", "can", "do", "how", "i", "the", "to"])

const indexDocumentation = (topics) =>
  topics.map((topic) => {
    const title = tokenize(topic.title).join(" ")
    return {
      topic,
      title,
      findable: tokenize([topic.title, topic.keywords].join(" ")).join(" "),
      content: tokenize([topic.purpose, topic.note, ...topic.steps].join(" ")).join(" "),
    }
  })

const searchDocumentation = (index, query) => {
  const tokens = tokenize(query).filter((token) => !questionWords.has(token))
  if (!tokens.length) return index.map(({ topic }) => topic)

  const phrase = tokens.join(" ")
  const matches = (haystack) => {
    const words = haystack.split(" ")
    return tokens.every((token) => words.some((word) => word.startsWith(token)))
  }
  return index
    .map(({ topic, title, findable, content }) => ({
      topic,
      rank: title.startsWith(phrase) ? 0
        : title.includes(phrase) ? 1
        : findable.includes(phrase) ? 2
        : matches(title) ? 3
        : matches(findable) ? 4
        : matches(`${findable} ${content}`) ? 5 : null,
    }))
    .filter(({ rank }) => rank !== null)
    .sort((a, b) => a.rank - b.rank || a.topic.title.localeCompare(b.topic.title, "en"))
    .map(({ topic }) => topic)
}

export { indexDocumentation, searchDocumentation }
