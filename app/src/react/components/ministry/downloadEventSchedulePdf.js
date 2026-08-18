import { jsPDF } from "jspdf"

const formatDate = (value, options) =>
  new Intl.DateTimeFormat("en-US", options).format(new Date(value))

const toDateKey = (value) => {
  const date = new Date(value)
  const month = `${date.getMonth() + 1}`.padStart(2, "0")
  const day = `${date.getDate()}`.padStart(2, "0")
  return `${date.getFullYear()}-${month}-${day}`
}

const dateFromKey = (value) => new Date(`${value}T12:00:00`)

const cleanFilePart = (value) =>
  String(value || "events")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")

const getOffsiteAddress = (event) => {
  if (event.is_offsite === false) return ""
  return event.offsite_address || event.address || event.location || ""
}

const getAssignmentText = (event) =>
  (event.visibleProfileAssignments || [])
    .map((assignment) => assignment.responsibilityName)
    .filter(Boolean)
    .join(", ")

export const eventsWithinRange = (events, startDate, endDate) =>
  [...events]
    .filter((event) => {
      const key = toDateKey(event.start_time)
      return key >= startDate && key <= endDate
    })
    .sort((left, right) => new Date(left.start_time) - new Date(right.start_time))

export const getEventRange = (events) => {
  const sorted = [...events]
    .filter((event) => event.start_time)
    .sort((left, right) => new Date(left.start_time) - new Date(right.start_time))
  const today = toDateKey(new Date())
  return {
    startDate: sorted.length ? toDateKey(sorted[0].start_time) : today,
    endDate: sorted.length ? toDateKey(sorted.at(-1).start_time) : today,
  }
}

export const createEventSchedulePdf = ({
  ministryName,
  events,
  startDate,
  endDate,
  filterLabel,
}) => {
  const doc = new jsPDF({ unit: "pt", format: "letter", orientation: "portrait" })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 48
  const contentWidth = pageWidth - margin * 2
  const footerY = pageHeight - 28
  let y = 52
  let pageNumber = 1

  const addFooter = () => {
    doc.setDrawColor(224, 224, 224)
    doc.line(margin, footerY - 12, pageWidth - margin, footerY - 12)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(8)
    doc.setTextColor(110, 110, 110)
    doc.text("The live Ministry app is authoritative. Downloaded schedules may become outdated.", margin, footerY)
    doc.text(String(pageNumber), pageWidth - margin, footerY, { align: "right" })
  }

  const addPage = () => {
    addFooter()
    doc.addPage()
    pageNumber += 1
    y = 44
  }

  const ensureSpace = (height) => {
    if (y + height > footerY - 22) addPage()
  }

  doc.setTextColor(137, 101, 66)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(10)
  doc.text(`${ministryName} MINISTRY`.toUpperCase(), margin, y)
  y += 25

  doc.setTextColor(24, 31, 43)
  doc.setFontSize(22)
  doc.text(filterLabel, margin, y)
  y += 23

  doc.setFont("helvetica", "normal")
  doc.setFontSize(11)
  doc.setTextColor(90, 97, 108)
  const rangeLabel = `From ${formatDate(dateFromKey(startDate), {
    month: "long",
    day: "numeric",
    year: "numeric",
  })} - ${formatDate(dateFromKey(endDate), {
    month: "long",
    day: "numeric",
    year: "numeric",
  })}`
  doc.text(rangeLabel, margin, y)
  y += 20
  doc.setDrawColor(193, 163, 135)
  doc.line(margin, y, pageWidth - margin, y)
  y += 22

  if (!events.length) {
    doc.setFontSize(12)
    doc.setTextColor(90, 97, 108)
    doc.text("No events in this view.", margin, y)
  } else {
    let currentDate = ""
    events.forEach((event) => {
      const eventDate = toDateKey(event.start_time)
      if (eventDate !== currentDate) {
        ensureSpace(42)
        currentDate = eventDate
        doc.setFont("helvetica", "bold")
        doc.setFontSize(10)
        doc.setTextColor(137, 101, 66)
        doc.text(
          formatDate(event.start_time, {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          }).toUpperCase(),
          margin,
          y,
        )
        y += 18
      }

      const address = getOffsiteAddress(event)
      const assignment = getAssignmentText(event)
      const details = []
      if (address) details.push(address)
      if (assignment) details.push(`Assignment: ${assignment}`)
      if (String(event.status || "").toLowerCase() === "cancelled") {
        details.push("CANCELLED")
      }
      const detailLines = details.flatMap((detail) =>
        doc.splitTextToSize(detail, contentWidth - 74),
      )
      const titleLines = doc.splitTextToSize(
        event.title || "Untitled event",
        contentWidth - 110,
      )
      const itemHeight =
        39 + Math.max(0, titleLines.length - 1) * 12 + detailLines.length * 12
      ensureSpace(itemHeight)

      doc.setFillColor(250, 248, 246)
      doc.roundedRect(margin, y - 11, contentWidth, itemHeight - 5, 4, 4, "F")
      doc.setFont("helvetica", "bold")
      doc.setFontSize(10)
      doc.setTextColor(24, 31, 43)
      doc.text(
        formatDate(event.start_time, { hour: "numeric", minute: "2-digit" }),
        margin + 12,
        y + 5,
      )
      doc.setFontSize(12)
      doc.text(titleLines, margin + 74, y + 5)
      let detailY = y + 21 + Math.max(0, titleLines.length - 1) * 12
      if (detailLines.length) {
        doc.setFont("helvetica", "normal")
        doc.setFontSize(9)
        doc.setTextColor(90, 97, 108)
        doc.text(detailLines, margin + 74, detailY)
      }
      y += Math.max(itemHeight, 39 + Math.max(0, titleLines.length - 1) * 12)
    })
  }

  addFooter()
  return doc
}

export const downloadEventSchedulePdf = (options) => {
  const doc = createEventSchedulePdf(options)
  const filename = [
    cleanFilePart(options.ministryName),
    cleanFilePart(options.filterLabel),
    options.startDate,
    "to",
    options.endDate,
  ].join("-")
  doc.save(`${filename}.pdf`)
}

export const openEventSchedulePdf = (options) => {
  const doc = createEventSchedulePdf(options)
  const pdfUrl = doc.output("bloburl")
  window.open(pdfUrl, "_blank", "noopener,noreferrer")
}
