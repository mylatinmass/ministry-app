import * as React from "react"
import { Helmet } from "react-helmet"

const Seo = ({ title, description }) => (
  <Helmet>
    <title>{title}</title>
    {description && <meta name="description" content={description} />}
    <meta name="robots" content="noindex,nofollow" />
  </Helmet>
)

export default Seo
