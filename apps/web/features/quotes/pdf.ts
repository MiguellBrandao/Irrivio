import type { Quote } from "@/features/quotes/types"
import {
  buildQuoteDocumentTitle,
  formatQuoteCurrency,
  formatQuoteDate,
  getQuoteValidUntilFallback,
} from "@/features/quotes/utils"
import type { AuthCompany } from "@/lib/auth/types"

type QuoteExportInput = {
  quote: Quote
  company: AuthCompany
}

type QuoteRenderResult = {
  canvas: HTMLCanvasElement
  width: number
  height: number
}

type TextBlock = {
  lines: string[]
  height: number
}

const BASE_WIDTH = 794
const MIN_BASE_HEIGHT = 1123
const RENDER_SCALE = 2
const PAGE_WIDTH_PT = 595.28
const FOOTER_SIDE_PADDING = 72

const colors = {
  text: "#1f2f27",
  muted: "#697462",
  accent: "#215442",
  accentMuted: "#7d8769",
  border: "#e8dfcc",
  borderSoft: "#efe8da",
  surface: "#f8f4ea",
}

export async function downloadQuotePdf({
  quote,
  company,
}: QuoteExportInput) {
  const rendered = await renderQuoteCanvas({ quote, company })
  const { jsPDF } = await import("jspdf")
  const pageHeightPt = PAGE_WIDTH_PT * (rendered.height / rendered.width)
  const doc = new jsPDF({
    unit: "pt",
    format: [PAGE_WIDTH_PT, pageHeightPt],
  })

  doc.setProperties({
    title: buildQuoteDocumentTitle(quote),
    subject: `Orcamento ${company.name}`,
    author: company.name,
    creator: "Irrivio",
  })

  doc.addImage(
    rendered.canvas.toDataURL("image/png"),
    "PNG",
    0,
    0,
    PAGE_WIDTH_PT,
    pageHeightPt
  )
  doc.save(buildQuoteFileName(quote, "pdf"))
}

export async function downloadQuotePng({
  quote,
  company,
}: QuoteExportInput) {
  const rendered = await renderQuoteCanvas({ quote, company })
  const blob = await canvasToBlob(rendered.canvas)

  downloadBlob(blob, buildQuoteFileName(quote, "png"))
}

async function renderQuoteCanvas({
  quote,
  company,
}: QuoteExportInput): Promise<QuoteRenderResult> {
  const logoImage = company.logo_path
    ? await loadImage(company.logo_path).catch(() => null)
    : null

  const layout = buildQuoteLayout({ quote, company, logoImage })
  const canvas = document.createElement("canvas")
  canvas.width = Math.round(layout.width * RENDER_SCALE)
  canvas.height = Math.round(layout.height * RENDER_SCALE)

  const context = canvas.getContext("2d")
  if (!context) {
    throw new Error("Nao foi possivel criar o documento do orcamento.")
  }

  context.scale(RENDER_SCALE, RENDER_SCALE)
  drawQuoteDocument({
    context,
    width: layout.width,
    height: layout.height,
    quote,
    company,
    logoImage,
  })

  return {
    canvas,
    width: layout.width,
    height: layout.height,
  }
}

function buildQuoteLayout({
  quote,
  company,
  logoImage,
}: QuoteExportInput & { logoImage: HTMLImageElement | null }) {
  const measureCanvas = document.createElement("canvas")
  const context = measureCanvas.getContext("2d")
  if (!context) {
    return { width: BASE_WIDTH, height: MIN_BASE_HEIGHT }
  }

  const width = BASE_WIDTH
  const marginX = 56
  const topY = 48
  const contentWidth = width - marginX * 2
  const clientTextWidth = contentWidth * 0.4
  const priceBoxWidth = 360

  let headerBottomY = topY + 110

  if (logoImage) {
    const logoSize = fitIntoBox(logoImage.width, logoImage.height, 208, 112)
    headerBottomY = Math.max(headerBottomY, topY + logoSize.height)
  }

  const clientStartY = headerBottomY + 44

  setCanvasFont(context, 600, 32)
  const addressBlock = measureTextBlock(context, quote.garden_address, clientTextWidth, 28)

  const priceBoxY = clientStartY + 24
  setCanvasFont(context, 400, 14)
  const priceNote = measureTextBlock(
    context,
    "Valor base sem IVA incluido. Sujeito a confirmacao final no momento da adjudicacao.",
    priceBoxWidth - 40,
    21
  )
  const priceBoxHeight = 94 + priceNote.height

  const clientBlockBottomY = clientStartY + 68 + addressBlock.height
  const clientAreaBottomY = Math.max(clientBlockBottomY, priceBoxY + priceBoxHeight)

  const servicesStartY = clientAreaBottomY + 42
  setCanvasFont(context, 400, 16)
  const serviceBlocks = quote.services.map((service) =>
    measureTextBlock(context, service, contentWidth - 28, 24)
  )
  const servicesHeight =
    40 +
    serviceBlocks.reduce((total, block) => total + block.height + 6, 0)

  const footerBlockHeight = measureFooterBlockHeight(context, company, contentWidth)
  const naturalHeight = servicesStartY + servicesHeight + 68 + footerBlockHeight

  return {
    width,
    height: Math.max(MIN_BASE_HEIGHT, Math.ceil(naturalHeight)),
  }
}

function drawQuoteDocument({
  context,
  width,
  height,
  quote,
  company,
  logoImage,
}: QuoteExportInput & {
  context: CanvasRenderingContext2D
  width: number
  height: number
  logoImage: HTMLImageElement | null
}) {
  const marginX = 56
  const topY = 48
  const contentWidth = width - marginX * 2
  const clientTextWidth = contentWidth * 0.4
  const priceBoxWidth = 360
  const priceBoxX = width - marginX - priceBoxWidth
  const validUntil = getQuoteValidUntilFallback(quote)
  const footerBlockHeight = measureFooterBlockHeight(context, company, contentWidth)

  context.fillStyle = "#ffffff"
  context.fillRect(0, 0, width, height)
  context.textBaseline = "top"

  let headerBottomY = topY + 110

  if (logoImage) {
    const logoSize = fitIntoBox(logoImage.width, logoImage.height, 208, 112)
    context.drawImage(logoImage, marginX, topY, logoSize.width, logoSize.height)
    headerBottomY = Math.max(headerBottomY, topY + logoSize.height)
  }

  context.textAlign = "right"
  setCanvasFill(context, colors.text)
  setCanvasFont(context, 600, 44)
  context.fillText("Orcamento", width - marginX, topY + 6)

  setCanvasFill(context, colors.accentMuted)
  setCanvasFont(context, 600, 13)
  context.fillText("DOCUMENTO COMERCIAL", width - marginX, topY + 64)

  setCanvasFill(context, colors.muted)
  setCanvasFont(context, 400, 16)
  context.fillText(`Criado em ${formatQuoteDate(quote.created_at)}`, width - marginX, topY + 92)
  context.fillText(`Valido ate ${formatQuoteDate(validUntil)}`, width - marginX, topY + 118)
  context.textAlign = "left"
  headerBottomY = Math.max(headerBottomY, topY + 134)

  const separatorY = headerBottomY + 18
  drawLine(context, marginX, separatorY, width - marginX, separatorY, colors.border)

  const clientStartY = separatorY + 34
  drawSectionLabel(context, "Cliente", marginX, clientStartY)

  setCanvasFill(context, colors.text)
  setCanvasFont(context, 600, 32)
  context.fillText(quote.garden_client_name, marginX, clientStartY + 30)

  setCanvasFill(context, colors.muted)
  setCanvasFont(context, 400, 16)
  const clientAddressBottomY = drawWrappedText(
    context,
    quote.garden_address,
    marginX,
    clientStartY + 84,
    clientTextWidth,
    28
  )

  const priceBoxY = clientStartY + 24
  const priceNoteBottomY = drawPriceBox(
    context,
    priceBoxX,
    priceBoxY,
    priceBoxWidth,
    quote
  )

  const clientAreaBottomY = Math.max(clientAddressBottomY, priceNoteBottomY)
  const servicesSeparatorY = clientAreaBottomY + 18
  drawLine(
    context,
    marginX,
    servicesSeparatorY,
    width - marginX,
    servicesSeparatorY,
    colors.borderSoft
  )

  const servicesStartY = servicesSeparatorY + 24
  drawSectionLabel(context, "Servicos incluidos", marginX, servicesStartY)
  setCanvasFill(context, colors.text)
  setCanvasFont(context, 600, 28)
  context.fillText("Proposta de intervencao", marginX, servicesStartY + 14)

  setCanvasFont(context, 400, 16)
  let currentY = servicesStartY + 46
  quote.services.forEach((service) => {
    setCanvasFill(context, colors.accent)
    setCanvasFont(context, 600, 16)
    context.fillText("-", marginX, currentY)

    setCanvasFill(context, colors.text)
    setCanvasFont(context, 400, 16)
    currentY = drawWrappedText(
      context,
      service,
      marginX + 20,
      currentY,
      contentWidth - 20,
      24
    )
    currentY += 6
  })

  const footerTopY = height - footerBlockHeight
  drawLine(context, marginX, footerTopY, width - marginX, footerTopY, colors.border)
  drawSectionLabel(context, "Contacto e faturacao", marginX, footerTopY + 20)

  setCanvasFill(context, colors.text)
  setCanvasFont(context, 400, 15)
  context.textAlign = "center"
  drawFooterDetails(context, company, width / 2, footerTopY + 48, contentWidth)
  context.textAlign = "left"
}

function drawPriceBox(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  quote: Quote
) {
  const noteWidth = width - 40

  setCanvasFont(context, 400, 14)
  const noteLines = wrapText(
    context,
    "Valor base sem IVA incluido. Sujeito a confirmacao final no momento da adjudicacao.",
    noteWidth
  )
  const noteHeight = noteLines.length * 21
  const height = 94 + noteHeight

  context.fillStyle = colors.surface
  context.strokeStyle = colors.border
  context.lineWidth = 1
  roundRect(context, x, y, width, height, 24)
  context.fill()
  context.stroke()

  setCanvasFill(context, colors.accentMuted)
  setCanvasFont(context, 600, 12)
  context.fillText("VALOR PROPOSTO", x + 20, y + 18)

  setCanvasFill(context, colors.accent)
  setCanvasFont(context, 600, 34)
  context.fillText(formatQuoteCurrency(Number(quote.price)), x + 20, y + 42)

  setCanvasFill(context, "#445248")
  setCanvasFont(context, 400, 14)
  drawTextLines(context, noteLines, x + 20, y + 82, 21)

  return y + height
}

function drawSectionLabel(
  context: CanvasRenderingContext2D,
  label: string,
  x: number,
  y: number
) {
  setCanvasFill(context, colors.accentMuted)
  setCanvasFont(context, 600, 12)
  context.fillText(label.toUpperCase(), x, y)
}

function drawWrappedText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
) {
  const lines = wrapText(context, text, maxWidth)
  drawTextLines(context, lines, x, y, lineHeight)
  return y + lines.length * lineHeight
}

function drawTextLines(
  context: CanvasRenderingContext2D,
  lines: string[],
  x: number,
  y: number,
  lineHeight: number
) {
  lines.forEach((line, index) => {
    context.fillText(line, x, y + index * lineHeight)
  })
}

function measureTextBlock(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  lineHeight: number
): TextBlock {
  const lines = wrapText(context, text, maxWidth)
  return {
    lines,
    height: lines.length * lineHeight,
  }
}

function buildFooterLineGroups(company: AuthCompany) {
  return [
    company.address,
    `NIF: ${company.nif}`,
    `Telm: ${company.mobile_phone}`,
    `Email: ${company.email}`,
    `IBAN: ${company.iban}`,
  ]
}

function measureFooterBlockHeight(
  context: CanvasRenderingContext2D,
  company: AuthCompany,
  contentWidth: number
) {
  setCanvasFont(context, 400, 15)

  const maxWidth = contentWidth - FOOTER_SIDE_PADDING
  const totalTextLines = buildFooterLineGroups(company).reduce((total, line) => {
    return total + wrapText(context, line, maxWidth).length
  }, 0)

  return 56 + totalTextLines * 24 + 12
}

function drawFooterDetails(
  context: CanvasRenderingContext2D,
  company: AuthCompany,
  centerX: number,
  startY: number,
  contentWidth: number
) {
  const maxWidth = contentWidth - FOOTER_SIDE_PADDING
  let currentY = startY

  buildFooterLineGroups(company).forEach((line) => {
    const wrappedLines = wrapText(context, line, maxWidth)
    drawTextLines(context, wrappedLines, centerX, currentY, 24)
    currentY += wrappedLines.length * 24
  })
}

function wrapText(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
) {
  const normalized = text.trim()
  if (!normalized) {
    return [""]
  }

  const paragraphs = normalized.split("\n")
  const lines: string[] = []

  paragraphs.forEach((paragraph) => {
    const words = paragraph.split(/\s+/)
    let line = ""

    words.forEach((word) => {
      const nextLine = line ? `${line} ${word}` : word

      if (context.measureText(nextLine).width <= maxWidth) {
        line = nextLine
        return
      }

      if (line) {
        lines.push(line)
      }
      line = word
    })

    if (line) {
      lines.push(line)
    }
  })

  return lines.length > 0 ? lines : [""]
}

function fitIntoBox(
  sourceWidth: number,
  sourceHeight: number,
  maxWidth: number,
  maxHeight: number
) {
  const ratio = Math.min(maxWidth / sourceWidth, maxHeight / sourceHeight, 1)

  return {
    width: sourceWidth * ratio,
    height: sourceHeight * ratio,
  }
}

function setCanvasFont(
  context: CanvasRenderingContext2D,
  weight: 400 | 600,
  size: number
) {
  context.font = `${weight} ${size}px "Segoe UI", Arial, sans-serif`
}

function setCanvasFill(context: CanvasRenderingContext2D, color: string) {
  context.fillStyle = color
}

function drawLine(
  context: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string
) {
  context.strokeStyle = color
  context.lineWidth = 1
  context.beginPath()
  context.moveTo(x1, y1)
  context.lineTo(x2, y2)
  context.stroke()
}

function roundRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  context.beginPath()
  context.moveTo(x + radius, y)
  context.lineTo(x + width - radius, y)
  context.quadraticCurveTo(x + width, y, x + width, y + radius)
  context.lineTo(x + width, y + height - radius)
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
  context.lineTo(x + radius, y + height)
  context.quadraticCurveTo(x, y + height, x, y + height - radius)
  context.lineTo(x, y + radius)
  context.quadraticCurveTo(x, y, x + radius, y)
  context.closePath()
}

async function loadImage(path: string) {
  const resolvedUrl = path.startsWith("data:image/")
    ? path
    : new URL(path, window.location.origin).toString()

  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = "anonymous"
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error("Nao foi possivel carregar o logo da empresa."))
    image.src = resolvedUrl
  })
}

function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Nao foi possivel gerar a imagem do orcamento."))
        return
      }

      resolve(blob)
    }, "image/png")
  })
}

function downloadBlob(blob: Blob, fileName: string) {
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = objectUrl
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(objectUrl)
}

function buildQuoteFileName(quote: Quote, extension: "pdf" | "png") {
  const safeClientName = sanitizeFileName(quote.garden_client_name)
  return `orcamento-${safeClientName || "cliente"}-${quote.id.slice(0, 8)}.${extension}`
}

function sanitizeFileName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}
