import type { Garden, GardenExpense, GardenProductUsage, IrrigationZone } from "@/features/gardens/types"
import {
  formatIrrigationFrequency,
  formatIrrigationTimeRange,
  getUpcomingIrrigationZones,
} from "@/features/gardens/irrigation"
import type { Employee, TeamOption } from "@/features/employees/types"
import type { Payment } from "@/features/payments/types"
import {
  formatCurrency,
  formatMonthYear,
  paymentStatusLabels,
} from "@/features/payments/utils"
import type { Quote } from "@/features/quotes/types"
import type { Product, StockRule } from "@/features/stock/types"
import {
  describeStockRule,
  formatStockQuantity,
  isStockRuleTriggered,
} from "@/features/stock/utils"
import type { Task, TaskWorkLog } from "@/features/calendar/types"
import { taskTypeLabels } from "@/features/calendar/utils"
import type {
  ReportDateRange,
  ReportPeriodType,
  ReportSummary,
} from "@/features/reports/types"
import {
  buildReportFileName,
  formatDate,
  isDateWithinRange,
} from "@/features/reports/utils"
import type { AuthCompany } from "@/lib/auth/types"

type ReportGenerationInput = {
  company: AuthCompany
  title: string
  periodType: ReportPeriodType
  periodLabel: string
  dateRange: ReportDateRange
  generatedByName: string
  generatedAt: Date
  gardens: Garden[]
  employees: Employee[]
  teams: TeamOption[]
  tasks: Task[]
  workLogs: TaskWorkLog[]
  payments: Payment[]
  expenses: GardenExpense[]
  productUsage: GardenProductUsage[]
  products: Product[]
  stockRules: StockRule[]
  irrigationZones: IrrigationZone[]
  quotes: Quote[]
}

type GeneratedReportDocument = {
  summary: ReportSummary
  fileName: string
  mimeType: "application/pdf"
  base64: string
}

type GeneralReportData = {
  summary: ReportSummary
  totalWorkedHours: number
  paymentsByGarden: Array<{
    gardenName: string
    expected: number
    received: number
    open: number
    directExpenses: number
    productExpenses: number
    gross: number
  }>
  paymentEntries: Array<{
    gardenName: string
    periodLabel: string
    expected: number
    received: number
    open: number
    status: string
  }>
  expensesByCategory: Array<{
    category: string
    total: number
    count: number
  }>
  expenseDetails: Array<{
    date: string
    gardenName: string
    category: string
    description: string
    amount: number
  }>
  productUsageByProduct: Array<{
    productName: string
    quantityLabel: string
    cost: number
    count: number
  }>
  productUsageByGarden: Array<{
    gardenName: string
    records: number
    cost: number
  }>
  taskTypeStats: Array<{ label: string; total: number }>
  taskGardenStats: Array<{ gardenName: string; total: number; completed: number }>
  taskTeamStats: Array<{ teamName: string; total: number; completed: number }>
  stockAlerts: Array<{
    productName: string
    rule: string
    currentStock: string
    emails: string
  }>
  stockSnapshot: Array<{
    productName: string
    stock: string
    unitPrice: string
  }>
  irrigationRows: Array<{
    gardenName: string
    zoneName: string
    frequency: string
    timeRange: string
    nextRun: string
  }>
  quoteRows: Array<{
    gardenName: string
    createdAt: string
    validUntil: string
    price: number
    services: string
  }>
}

type PdfTableColumn = {
  header: string
  width: number
  align?: "left" | "right" | "center"
}

type PdfContext = {
  doc: import("jspdf").jsPDF
  company: AuthCompany
  title: string
  periodLabel: string
  generatedAt: Date
  generatedByName: string
  logoDataUrl: string | null
  marginX: number
  topMargin: number
  bottomMargin: number
  contentWidth: number
  pageHeight: number
  cursorY: number
  hasRunningHeader: boolean
}

const expenseCategoryLabels: Record<GardenExpense["category"], string> = {
  fuel: "Combustivel",
  tolls: "Portagens",
  parking: "Estacionamento",
  equipment: "Equipamento",
  maintenance: "Manutencao",
  transport: "Transporte",
  other: "Outro",
}

const colors = {
  text: "#1f2f27",
  muted: "#6b7280",
  accent: "#215442",
  accentSoft: "#e7efe9",
  border: "#d9d3c3",
  surface: "#f7f3e8",
}

export async function buildGeneralReportDocument(
  input: ReportGenerationInput
): Promise<GeneratedReportDocument> {
  const [{ jsPDF }, logoDataUrl] = await Promise.all([
    import("jspdf"),
    loadImageAsDataUrl(input.company.logo_path),
  ])
  const reportData = buildGeneralReportData(input)
  const doc = new jsPDF({
    unit: "mm",
    format: "a4",
  })
  const marginX = 14
  const topMargin = 14
  const bottomMargin = 12
  const contentWidth = doc.internal.pageSize.getWidth() - marginX * 2
  const pageHeight = doc.internal.pageSize.getHeight()

  const context: PdfContext = {
    doc,
    company: input.company,
    title: input.title,
    periodLabel: input.periodLabel,
    generatedAt: input.generatedAt,
    generatedByName: input.generatedByName,
    logoDataUrl,
    marginX,
    topMargin,
    bottomMargin,
    contentWidth,
    pageHeight,
    cursorY: topMargin,
    hasRunningHeader: false,
  }

  doc.setTextColor(colors.text)
  doc.setDrawColor(colors.border)
  doc.setFillColor(colors.surface)

  drawCover(context, reportData)
  drawSummarySection(context, reportData)
  drawFinanceSection(context, reportData)
  drawExpenseSection(context, reportData)
  drawProductUsageSection(context, reportData)
  drawOperationSection(context, reportData)
  drawStockSection(context, reportData)
  drawIrrigationSection(context, reportData)
  drawQuotesSection(context, reportData)
  addPageFooters(context)

  const arrayBuffer = doc.output("arraybuffer")
  const base64 = arrayBufferToBase64(arrayBuffer)

  return {
    summary: reportData.summary,
    fileName: buildReportFileName(input.title, input.generatedAt),
    mimeType: "application/pdf",
    base64,
  }
}

export function downloadStoredReportPdf(base64: string, fileName: string) {
  const blob = base64ToPdfBlob(base64)
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = objectUrl
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(objectUrl)
}

function buildGeneralReportData(input: ReportGenerationInput): GeneralReportData {
  const gardensById = new Map(input.gardens.map((garden) => [garden.id, garden]))
  const teamsById = new Map(input.teams.map((team) => [team.id, team]))
  const productsById = new Map(input.products.map((product) => [product.id, product]))
  const stockAlerts = input.stockRules.filter((rule) => isStockRuleTriggered(rule))
  const paymentEntries = buildPaymentEntriesForRange(input.gardens, input.payments, input.dateRange)
  const revenue = input.payments.reduce((sum, payment) => {
    if (!isPaymentInsideRange(payment, input.dateRange)) {
      return sum
    }

    return sum + toFiniteNumber(payment.amount)
  }, 0)
  const expectedRevenue = paymentEntries.reduce((sum, entry) => sum + entry.expected, 0)
  const openAmount = paymentEntries.reduce((sum, entry) => sum + entry.open, 0)
  const directExpenses = input.expenses.reduce(
    (sum, expense) => sum + toFiniteNumber(expense.amount),
    0
  )
  const productUsageExpenses = input.productUsage.reduce((sum, usage) => {
    const product = productsById.get(usage.product_id)
    return sum + toFiniteNumber(usage.quantity) * toFiniteNumber(product?.unit_price)
  }, 0)
  const totalExpenses = directExpenses + productUsageExpenses
  const completedTaskIds = new Set(input.workLogs.map((workLog) => workLog.task_id))
  const activeTeamIds = new Set<string>()

  input.tasks.forEach((task) => {
    if (task.team_id) {
      activeTeamIds.add(task.team_id)
    }
  })
  input.workLogs.forEach((workLog) => activeTeamIds.add(workLog.team_id))

  const membersWithActivity = input.employees.filter(
    (employee) =>
      employee.active !== false &&
      employee.team_ids.some((teamId) => activeTeamIds.has(teamId))
  ).length
  const gardensActive = input.gardens.filter((garden) => garden.status === "active").length
  const quotesInRange = input.quotes.filter((quote) =>
    isDateWithinRange(quote.created_at, input.dateRange)
  )
  const totalWorkedHours =
    input.workLogs.reduce((sum, workLog) => {
      if (!workLog.start_time || !workLog.end_time) {
        return sum
      }

      return (
        sum +
        Math.max(
          0,
          new Date(workLog.end_time).getTime() - new Date(workLog.start_time).getTime()
        )
      )
    }, 0) /
    (1000 * 60 * 60)

  const paymentsByGardenMap = new Map<
    string,
    {
      gardenName: string
      expected: number
      received: number
      open: number
      directExpenses: number
      productExpenses: number
    }
  >()

  paymentEntries.forEach((entry) => {
    const current = paymentsByGardenMap.get(entry.gardenId) ?? {
      gardenName: entry.gardenName,
      expected: 0,
      received: 0,
      open: 0,
      directExpenses: 0,
      productExpenses: 0,
    }

    current.expected += entry.expected
    current.received += entry.received
    current.open += entry.open
    paymentsByGardenMap.set(entry.gardenId, current)
  })

  input.expenses.forEach((expense) => {
    const current = paymentsByGardenMap.get(expense.garden_id) ?? {
      gardenName: gardensById.get(expense.garden_id)?.client_name ?? "Jardim",
      expected: 0,
      received: 0,
      open: 0,
      directExpenses: 0,
      productExpenses: 0,
    }

    current.directExpenses += toFiniteNumber(expense.amount)
    paymentsByGardenMap.set(expense.garden_id, current)
  })

  input.productUsage.forEach((usage) => {
    const current = paymentsByGardenMap.get(usage.garden_id) ?? {
      gardenName: gardensById.get(usage.garden_id)?.client_name ?? "Jardim",
      expected: 0,
      received: 0,
      open: 0,
      directExpenses: 0,
      productExpenses: 0,
    }
    const product = productsById.get(usage.product_id)
    current.productExpenses +=
      toFiniteNumber(usage.quantity) * toFiniteNumber(product?.unit_price)
    paymentsByGardenMap.set(usage.garden_id, current)
  })

  const expensesByCategoryMap = new Map<string, { category: string; total: number; count: number }>()
  input.expenses.forEach((expense) => {
    const label = expenseCategoryLabels[expense.category]
    const current = expensesByCategoryMap.get(label) ?? {
      category: label,
      total: 0,
      count: 0,
    }

    current.total += toFiniteNumber(expense.amount)
    current.count += 1
    expensesByCategoryMap.set(label, current)
  })

  const productUsageByProductMap = new Map<
    string,
    { productName: string; unit: Product["unit"]; quantity: number; cost: number; count: number }
  >()
  input.productUsage.forEach((usage) => {
    const product = productsById.get(usage.product_id)
    const current = productUsageByProductMap.get(usage.product_id) ?? {
      productName: usage.product_name,
      unit: usage.product_unit,
      quantity: 0,
      cost: 0,
      count: 0,
    }

    current.quantity += toFiniteNumber(usage.quantity)
    current.cost += toFiniteNumber(usage.quantity) * toFiniteNumber(product?.unit_price)
    current.count += 1
    productUsageByProductMap.set(usage.product_id, current)
  })

  const productUsageByGardenMap = new Map<string, { gardenName: string; records: number; cost: number }>()
  input.productUsage.forEach((usage) => {
    const product = productsById.get(usage.product_id)
    const current = productUsageByGardenMap.get(usage.garden_id) ?? {
      gardenName: gardensById.get(usage.garden_id)?.client_name ?? "Jardim",
      records: 0,
      cost: 0,
    }

    current.records += 1
    current.cost += toFiniteNumber(usage.quantity) * toFiniteNumber(product?.unit_price)
    productUsageByGardenMap.set(usage.garden_id, current)
  })

  const taskTypeStatsMap = new Map<string, number>()
  input.tasks.forEach((task) => {
    const label = taskTypeLabels[task.task_type]
    taskTypeStatsMap.set(label, (taskTypeStatsMap.get(label) ?? 0) + 1)
  })

  const taskGardenStatsMap = new Map<string, { gardenName: string; total: number; completed: number }>()
  input.tasks.forEach((task) => {
    const current = taskGardenStatsMap.get(task.garden_id) ?? {
      gardenName: gardensById.get(task.garden_id)?.client_name ?? "Jardim",
      total: 0,
      completed: 0,
    }
    current.total += 1
    if (completedTaskIds.has(task.id)) {
      current.completed += 1
    }
    taskGardenStatsMap.set(task.garden_id, current)
  })

  const taskTeamStatsMap = new Map<string, { teamName: string; total: number; completed: number }>()
  input.tasks.forEach((task) => {
    const teamKey = task.team_id ?? "without-team"
    const current = taskTeamStatsMap.get(teamKey) ?? {
      teamName: task.team_id ? teamsById.get(task.team_id)?.name ?? "Equipa" : "Sem equipa",
      total: 0,
      completed: 0,
    }
    current.total += 1
    if (completedTaskIds.has(task.id)) {
      current.completed += 1
    }
    taskTeamStatsMap.set(teamKey, current)
  })

  return {
    summary: {
      revenue,
      expected_revenue: expectedRevenue,
      open_amount: openAmount,
      direct_expenses: directExpenses,
      product_usage_expenses: productUsageExpenses,
      total_expenses: totalExpenses,
      gross: revenue - totalExpenses,
      gardens_active: gardensActive,
      tasks_total: input.tasks.length,
      tasks_completed: completedTaskIds.size,
      tasks_pending: Math.max(input.tasks.length - completedTaskIds.size, 0),
      teams_with_activity: activeTeamIds.size,
      members_with_activity: membersWithActivity,
      stock_alerts: stockAlerts.length,
      quotes_created: quotesInRange.length,
      quotes_value: quotesInRange.reduce((sum, quote) => sum + toFiniteNumber(quote.price), 0),
    },
    totalWorkedHours,
    paymentsByGarden: [...paymentsByGardenMap.values()]
      .map((row) => ({
        ...row,
        gross: row.received - row.directExpenses - row.productExpenses,
      }))
      .sort(
        (left, right) =>
          right.received - left.received || left.gardenName.localeCompare(right.gardenName)
      ),
    paymentEntries: paymentEntries.map((entry) => ({
      gardenName: entry.gardenName,
      periodLabel: entry.periodLabel,
      expected: entry.expected,
      received: entry.received,
      open: entry.open,
      status: paymentStatusLabels[entry.status],
    })),
    expensesByCategory: [...expensesByCategoryMap.values()].sort(
      (left, right) => right.total - left.total || left.category.localeCompare(right.category)
    ),
    expenseDetails: [...input.expenses]
      .sort((left, right) => right.date.localeCompare(left.date))
      .map((expense) => ({
        date: formatDate(expense.date),
        gardenName: gardensById.get(expense.garden_id)?.client_name ?? "Jardim",
        category: expenseCategoryLabels[expense.category],
        description: expense.description?.trim() || "-",
        amount: toFiniteNumber(expense.amount),
      })),
    productUsageByProduct: [...productUsageByProductMap.values()]
      .map((entry) => ({
        productName: entry.productName,
        quantityLabel: formatStockQuantity(String(roundNumber(entry.quantity)), entry.unit),
        cost: entry.cost,
        count: entry.count,
      }))
      .sort(
        (left, right) => right.cost - left.cost || left.productName.localeCompare(right.productName)
      ),
    productUsageByGarden: [...productUsageByGardenMap.values()].sort(
      (left, right) => right.cost - left.cost || left.gardenName.localeCompare(right.gardenName)
    ),
    taskTypeStats: [...taskTypeStatsMap.entries()]
      .map(([label, total]) => ({ label, total }))
      .sort((left, right) => right.total - left.total || left.label.localeCompare(right.label)),
    taskGardenStats: [...taskGardenStatsMap.values()].sort(
      (left, right) => right.total - left.total || left.gardenName.localeCompare(right.gardenName)
    ),
    taskTeamStats: [...taskTeamStatsMap.values()].sort(
      (left, right) => right.total - left.total || left.teamName.localeCompare(right.teamName)
    ),
    stockAlerts: stockAlerts.map((rule) => ({
      productName: rule.product_name,
      rule: describeStockRule(rule),
      currentStock: formatStockQuantity(rule.product_stock_quantity, rule.product_unit),
      emails: rule.emails.join(", ") || "-",
    })),
    stockSnapshot: [...input.products]
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((product) => ({
        productName: product.name,
        stock: formatStockQuantity(product.stock_quantity, product.unit),
        unitPrice: formatCurrency(toFiniteNumber(product.unit_price)),
      })),
    irrigationRows: getUpcomingIrrigationZones(input.irrigationZones)
      .slice(0, 24)
      .map(({ zone, nextDate }) => ({
        gardenName: gardensById.get(zone.garden_id)?.client_name ?? "Jardim",
        zoneName: zone.name,
        frequency: formatIrrigationFrequency(zone),
        timeRange: formatIrrigationTimeRange(zone),
        nextRun: new Intl.DateTimeFormat("pt-PT", {
          dateStyle: "short",
          timeStyle: "short",
        }).format(nextDate),
      })),
    quoteRows: quotesInRange
      .sort((left, right) => right.created_at.localeCompare(left.created_at))
      .map((quote) => ({
        gardenName: quote.garden_client_name,
        createdAt: formatDate(quote.created_at),
        validUntil: formatDate(quote.valid_until),
        price: toFiniteNumber(quote.price),
        services: quote.services.join(", "),
      })),
  }
}

function buildPaymentEntriesForRange(
  gardens: Garden[],
  payments: Payment[],
  range: ReportDateRange
) {
  const monthKeys = getMonthKeys(range, gardens, payments)
  const paymentsMap = new Map<string, Payment[]>()

  payments.forEach((payment) => {
    const key = `${payment.garden_id}-${payment.year}-${payment.month}`
    const current = paymentsMap.get(key) ?? []
    current.push(payment)
    paymentsMap.set(key, current)
  })

  const entries: Array<{
    gardenId: string
    gardenName: string
    periodLabel: string
    expected: number
    received: number
    open: number
    status: "pending" | "partial" | "paid"
  }> = []

  gardens.forEach((garden) => {
    const monthlyAmount = toFiniteNumber(garden.monthly_price)

    if (monthlyAmount <= 0) {
      return
    }

    monthKeys.forEach((monthKey) => {
      if (!isGardenActiveForMonth(garden, monthKey.date)) {
        return
      }

      const key = `${garden.id}-${monthKey.year}-${monthKey.month}`
      const relatedPayments = paymentsMap.get(key) ?? []
      const received = relatedPayments.reduce(
        (sum, payment) => sum + toFiniteNumber(payment.amount),
        0
      )
      const open = Math.max(monthlyAmount - received, 0)

      entries.push({
        gardenId: garden.id,
        gardenName: garden.client_name,
        periodLabel: monthKey.label,
        expected: monthlyAmount,
        received,
        open,
        status:
          received <= 0 ? "pending" : received >= monthlyAmount ? "paid" : "partial",
      })
    })
  })

  return entries.sort((left, right) => right.periodLabel.localeCompare(left.periodLabel))
}

function getMonthKeys(range: ReportDateRange, gardens: Garden[], payments: Payment[]) {
  const resolvedTo = new Date((range.to ?? new Date()).getFullYear(), (range.to ?? new Date()).getMonth(), 1)

  let resolvedFrom: Date
  if (range.from) {
    resolvedFrom = new Date(range.from.getFullYear(), range.from.getMonth(), 1)
  } else {
    const candidateDates = [
      ...gardens.map((garden) => garden.start_date || garden.created_at),
      ...payments.map((payment) => `${payment.year}-${String(payment.month).padStart(2, "0")}-01`),
    ]
      .filter(Boolean)
      .map((value) => new Date(value))
      .filter((date) => !Number.isNaN(date.getTime()))

    const earliest = candidateDates.sort((left, right) => left.getTime() - right.getTime())[0]
    resolvedFrom = earliest
      ? new Date(earliest.getFullYear(), earliest.getMonth(), 1)
      : resolvedTo
  }

  const months: Array<{ month: number; year: number; label: string; date: Date }> = []
  const cursor = new Date(resolvedTo.getFullYear(), resolvedTo.getMonth(), 1)

  while (cursor >= resolvedFrom) {
    months.push({
      month: cursor.getMonth() + 1,
      year: cursor.getFullYear(),
      label: formatMonthYear(cursor),
      date: new Date(cursor),
    })

    cursor.setMonth(cursor.getMonth() - 1)
  }

  return months
}

function isGardenActiveForMonth(garden: Garden, targetMonth: Date) {
  const reference = new Date(garden.start_date ?? garden.created_at)
  const endOfTargetMonth = new Date(
    targetMonth.getFullYear(),
    targetMonth.getMonth() + 1,
    0
  )

  return reference <= endOfTargetMonth
}

function isPaymentInsideRange(payment: Payment, range: ReportDateRange) {
  const paymentMonthDate = new Date(payment.year, payment.month - 1, 1)

  if (range.from) {
    const fromMonthDate = new Date(range.from.getFullYear(), range.from.getMonth(), 1)
    if (paymentMonthDate < fromMonthDate) {
      return false
    }
  }

  if (range.to) {
    const toMonthDate = new Date(range.to.getFullYear(), range.to.getMonth(), 1)
    if (paymentMonthDate > toMonthDate) {
      return false
    }
  }

  return true
}

function drawCover(context: PdfContext, reportData: GeneralReportData) {
  const { doc, marginX, contentWidth } = context
  let topY = context.cursorY
  let logoBottomY = topY

  if (context.logoDataUrl) {
    const properties = doc.getImageProperties(context.logoDataUrl)
    const maxWidth = 42
    const maxHeight = 24
    const scale = Math.min(maxWidth / properties.width, maxHeight / properties.height, 1)
    const logoWidth = properties.width * scale
    const logoHeight = properties.height * scale

    doc.addImage(context.logoDataUrl, "PNG", marginX, topY, logoWidth, logoHeight)
    logoBottomY = topY + logoHeight
  }

  const titleY = logoBottomY + 14

  doc.setFont("helvetica", "bold")
  doc.setFontSize(22)
  doc.setTextColor(colors.text)
  doc.text(context.title, marginX, titleY)

  doc.setFont("helvetica", "normal")
  doc.setFontSize(11)
  doc.setTextColor(colors.muted)
  const metaLines = [
    context.company.name,
    `Periodo: ${context.periodLabel}`,
    `Gerado por ${context.generatedByName} em ${new Intl.DateTimeFormat("pt-PT", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(context.generatedAt)}`,
  ]
  metaLines.forEach((line, index) => {
    doc.text(line, marginX, titleY + 10 + index * 6)
  })

  topY = titleY + 34
  doc.setFillColor(colors.surface)
  doc.roundedRect(marginX, topY, contentWidth, 24, 4, 4, "F")
  doc.setFont("helvetica", "bold")
  doc.setFontSize(12)
  doc.setTextColor(colors.accent)
  doc.text("Leitura rapida", marginX + 6, topY + 8)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(10)
  doc.setTextColor(colors.text)
  const summaryLine =
    `Recebido ${formatCurrency(reportData.summary.revenue)} · ` +
    `Despesas ${formatCurrency(reportData.summary.total_expenses)} · ` +
    `Bruto ${formatCurrency(reportData.summary.gross)} · ` +
    `${reportData.summary.tasks_total} tarefa(s) no periodo`
  doc.text(doc.splitTextToSize(summaryLine, contentWidth - 12), marginX + 6, topY + 14)

  context.cursorY = topY + 32
}

function drawSummarySection(context: PdfContext, reportData: GeneralReportData) {
  drawSectionTitle(context, "Resumo executivo", "Indicadores centrais do periodo selecionado.")

  drawStatGrid(context, [
    { label: "Recebido", value: formatCurrency(reportData.summary.revenue) },
    { label: "Previsto", value: formatCurrency(reportData.summary.expected_revenue) },
    { label: "Em falta", value: formatCurrency(reportData.summary.open_amount) },
    { label: "Despesas diretas", value: formatCurrency(reportData.summary.direct_expenses) },
    {
      label: "Produtos utilizados",
      value: formatCurrency(reportData.summary.product_usage_expenses),
    },
    { label: "Bruto final", value: formatCurrency(reportData.summary.gross) },
    { label: "Tarefas concluidas", value: String(reportData.summary.tasks_completed) },
    { label: "Horas registadas", value: `${roundNumber(reportData.totalWorkedHours)} h` },
  ])
}

function drawFinanceSection(context: PdfContext, reportData: GeneralReportData) {
  startSectionOnNewPage(context)
  drawSectionTitle(context, "Financeiro", "Pagamentos previstos, recebidos e margem por jardim.")

  drawTable(context, {
    title: "Resumo por jardim",
    columns: [
      { header: "Jardim", width: 46 },
      { header: "Previsto", width: 22, align: "right" },
      { header: "Recebido", width: 22, align: "right" },
      { header: "Em falta", width: 22, align: "right" },
      { header: "Despesas", width: 22, align: "right" },
      { header: "Produtos", width: 22, align: "right" },
      { header: "Bruto", width: 22, align: "right" },
    ],
    rows: reportData.paymentsByGarden.map((row) => [
      row.gardenName,
      formatCurrency(row.expected),
      formatCurrency(row.received),
      formatCurrency(row.open),
      formatCurrency(row.directExpenses),
      formatCurrency(row.productExpenses),
      formatCurrency(row.gross),
    ]),
    emptyLabel: "Nao ha dados financeiros por jardim para este periodo.",
  })

  drawTable(context, {
    title: "Pagamentos por periodo",
    columns: [
      { header: "Jardim", width: 46 },
      { header: "Periodo", width: 32 },
      { header: "Previsto", width: 22, align: "right" },
      { header: "Recebido", width: 22, align: "right" },
      { header: "Em falta", width: 22, align: "right" },
      { header: "Estado", width: 28, align: "center" },
    ],
    rows: reportData.paymentEntries.map((row) => [
      row.gardenName,
      row.periodLabel,
      formatCurrency(row.expected),
      formatCurrency(row.received),
      formatCurrency(row.open),
      row.status,
    ]),
    emptyLabel: "Nao existem pagamentos no periodo selecionado.",
  })
}

function drawExpenseSection(context: PdfContext, reportData: GeneralReportData) {
  startSectionOnNewPage(context)
  drawSectionTitle(context, "Despesas", "Categorias e detalhes das despesas registadas no periodo.")

  drawTable(context, {
    title: "Totais por categoria",
    columns: [
      { header: "Categoria", width: 74 },
      { header: "Registos", width: 28, align: "right" },
      { header: "Total", width: 40, align: "right" },
    ],
    rows: reportData.expensesByCategory.map((row) => [
      row.category,
      String(row.count),
      formatCurrency(row.total),
    ]),
    emptyLabel: "Nao existem despesas registadas no periodo.",
  })

  drawTable(context, {
    title: "Despesas detalhadas",
    columns: [
      { header: "Data", width: 18 },
      { header: "Jardim", width: 34 },
      { header: "Categoria", width: 26 },
      { header: "Descricao", width: 64 },
      { header: "Valor", width: 24, align: "right" },
    ],
    rows: reportData.expenseDetails.map((row) => [
      row.date,
      row.gardenName,
      row.category,
      row.description,
      formatCurrency(row.amount),
    ]),
    emptyLabel: "Nao existem despesas para listar.",
  })
}

function drawProductUsageSection(context: PdfContext, reportData: GeneralReportData) {
  startSectionOnNewPage(context)
  drawSectionTitle(context, "Produtos utilizados", "Consumo de stock e respetivo custo no periodo.")

  drawTable(context, {
    title: "Consumo por produto",
    columns: [
      { header: "Produto", width: 72 },
      { header: "Quantidade", width: 38 },
      { header: "Registos", width: 24, align: "right" },
      { header: "Custo", width: 28, align: "right" },
    ],
    rows: reportData.productUsageByProduct.map((row) => [
      row.productName,
      row.quantityLabel,
      String(row.count),
      formatCurrency(row.cost),
    ]),
    emptyLabel: "Nao existem produtos utilizados no periodo.",
  })

  drawTable(context, {
    title: "Custo por jardim",
    columns: [
      { header: "Jardim", width: 88 },
      { header: "Registos", width: 28, align: "right" },
      { header: "Custo", width: 36, align: "right" },
    ],
    rows: reportData.productUsageByGarden.map((row) => [
      row.gardenName,
      String(row.records),
      formatCurrency(row.cost),
    ]),
    emptyLabel: "Nao ha custo de produtos por jardim neste periodo.",
  })
}

function drawOperationSection(context: PdfContext, reportData: GeneralReportData) {
  startSectionOnNewPage(context)
  drawSectionTitle(context, "Operacao", "Atividade por tipo de tarefa, jardim e equipa.")

  drawStatGrid(context, [
    { label: "Tarefas no periodo", value: String(reportData.summary.tasks_total) },
    { label: "Concluidas", value: String(reportData.summary.tasks_completed) },
    { label: "Pendentes", value: String(reportData.summary.tasks_pending) },
    { label: "Equipas com atividade", value: String(reportData.summary.teams_with_activity) },
    { label: "Membros envolvidos", value: String(reportData.summary.members_with_activity) },
    { label: "Horas registadas", value: `${roundNumber(reportData.totalWorkedHours)} h` },
  ])

  drawTable(context, {
    title: "Tarefas por tipo",
    columns: [
      { header: "Tipo", width: 92 },
      { header: "Total", width: 28, align: "right" },
    ],
    rows: reportData.taskTypeStats.map((row) => [row.label, String(row.total)]),
    emptyLabel: "Nao existem tarefas no periodo selecionado.",
  })

  drawTable(context, {
    title: "Tarefas por jardim",
    columns: [
      { header: "Jardim", width: 88 },
      { header: "Total", width: 20, align: "right" },
      { header: "Concluidas", width: 32, align: "right" },
    ],
    rows: reportData.taskGardenStats.map((row) => [
      row.gardenName,
      String(row.total),
      String(row.completed),
    ]),
    emptyLabel: "Nao existem tarefas agrupadas por jardim.",
  })

  drawTable(context, {
    title: "Tarefas por equipa",
    columns: [
      { header: "Equipa", width: 88 },
      { header: "Total", width: 20, align: "right" },
      { header: "Concluidas", width: 32, align: "right" },
    ],
    rows: reportData.taskTeamStats.map((row) => [
      row.teamName,
      String(row.total),
      String(row.completed),
    ]),
    emptyLabel: "Nao existem tarefas agrupadas por equipa.",
  })
}

function drawStockSection(context: PdfContext, reportData: GeneralReportData) {
  startSectionOnNewPage(context)
  drawSectionTitle(context, "Stock e regras", "Estado atual do stock e regras acionadas neste momento.")

  drawTable(context, {
    title: "Alertas ativos",
    columns: [
      { header: "Produto", width: 40 },
      { header: "Regra", width: 52 },
      { header: "Stock atual", width: 30 },
      { header: "Emails", width: 54 },
    ],
    rows: reportData.stockAlerts.map((row) => [
      row.productName,
      row.rule,
      row.currentStock,
      row.emails,
    ]),
    emptyLabel: "Nenhuma regra de stock esta acionada neste momento.",
  })

  drawTable(context, {
    title: "Snapshot do stock",
    columns: [
      { header: "Produto", width: 86 },
      { header: "Stock", width: 42 },
      { header: "Preco/unid.", width: 28, align: "right" },
    ],
    rows: reportData.stockSnapshot.map((row) => [
      row.productName,
      row.stock,
      row.unitPrice,
    ]),
    emptyLabel: "Nao existem produtos registados.",
  })
}

function drawIrrigationSection(context: PdfContext, reportData: GeneralReportData) {
  startSectionOnNewPage(context)
  drawSectionTitle(context, "Sistema de irrigacao", "Proximas regas e configuracao ativa das zonas.")

  drawTable(context, {
    title: "Zonas com proxima rega",
    columns: [
      { header: "Jardim", width: 38 },
      { header: "Zona", width: 28 },
      { header: "Frequencia", width: 38 },
      { header: "Horario", width: 24 },
      { header: "Proxima", width: 34 },
    ],
    rows: reportData.irrigationRows.map((row) => [
      row.gardenName,
      row.zoneName,
      row.frequency,
      row.timeRange,
      row.nextRun,
    ]),
    emptyLabel: "Nao existem zonas de irrigacao ativas com proxima rega.",
  })
}

function drawQuotesSection(context: PdfContext, reportData: GeneralReportData) {
  startSectionOnNewPage(context)
  drawSectionTitle(context, "Orcamentos", "Orcamentos criados no periodo selecionado.")

  drawStatGrid(context, [
    { label: "Orcamentos criados", value: String(reportData.summary.quotes_created) },
    { label: "Valor total proposto", value: formatCurrency(reportData.summary.quotes_value) },
  ])

  drawTable(context, {
    title: "Orcamentos do periodo",
    columns: [
      { header: "Jardim", width: 38 },
      { header: "Criado", width: 20 },
      { header: "Valido ate", width: 22 },
      { header: "Servicos", width: 70 },
      { header: "Valor", width: 22, align: "right" },
    ],
    rows: reportData.quoteRows.map((row) => [
      row.gardenName,
      row.createdAt,
      row.validUntil,
      row.services,
      formatCurrency(row.price),
    ]),
    emptyLabel: "Nao existem orcamentos criados no periodo.",
  })
}

function drawSectionTitle(context: PdfContext, title: string, description?: string) {
  ensureSpace(context, description ? 18 : 12)
  drawRunningHeaderIfNeeded(context)

  const { doc, marginX } = context
  doc.setFont("helvetica", "bold")
  doc.setFontSize(14)
  doc.setTextColor(colors.accent)
  doc.text(title, marginX, context.cursorY)
  context.cursorY += 6

  if (description) {
    doc.setFont("helvetica", "normal")
    doc.setFontSize(9.5)
    doc.setTextColor(colors.muted)
    const lines = doc.splitTextToSize(description, context.contentWidth)
    doc.text(lines, marginX, context.cursorY)
    context.cursorY += lines.length * 4 + 2
  }
}

function drawStatGrid(
  context: PdfContext,
  stats: Array<{ label: string; value: string }>
) {
  const columns = 2
  const gap = 4
  const cardWidth = (context.contentWidth - gap) / columns

  for (let index = 0; index < stats.length; index += columns) {
    const row = stats.slice(index, index + columns)
    ensureSpace(context, 18)

    row.forEach((stat, offset) => {
      const x = context.marginX + offset * (cardWidth + gap)
      const y = context.cursorY

      context.doc.setFillColor(colors.surface)
      context.doc.roundedRect(x, y, cardWidth, 16, 3, 3, "F")
      context.doc.setFont("helvetica", "normal")
      context.doc.setFontSize(8)
      context.doc.setTextColor(colors.muted)
      context.doc.text(stat.label.toUpperCase(), x + 4, y + 5)
      context.doc.setFont("helvetica", "bold")
      context.doc.setFontSize(12)
      context.doc.setTextColor(colors.text)
      context.doc.text(stat.value, x + 4, y + 11)
    })

    context.cursorY += 19
  }

  context.cursorY += 2
}

function drawTable(
  context: PdfContext,
  {
    title,
    columns,
    rows,
    emptyLabel,
  }: {
    title: string
    columns: PdfTableColumn[]
    rows: string[][]
    emptyLabel: string
  }
) {
  ensureSpace(context, 10)
  drawRunningHeaderIfNeeded(context)

  const { doc, marginX } = context

  doc.setFont("helvetica", "bold")
  doc.setFontSize(11)
  doc.setTextColor(colors.text)
  doc.text(title, marginX, context.cursorY)
  context.cursorY += 5

  if (rows.length === 0) {
    doc.setFont("helvetica", "normal")
    doc.setFontSize(9)
    doc.setTextColor(colors.muted)
    doc.text(emptyLabel, marginX, context.cursorY)
    context.cursorY += 7
    return
  }

  drawTableHeader(context, columns)

  rows.forEach((row) => {
    const cellLines = row.map((value, index) =>
      doc.splitTextToSize(value || "-", columns[index]?.width - 3)
    )
    const rowHeight = Math.max(...cellLines.map((lines) => lines.length), 1) * 4 + 4

    if (context.cursorY + rowHeight > context.pageHeight - context.bottomMargin) {
      addNewPage(context)
      drawTableHeader(context, columns)
    }

    let currentX = marginX

    columns.forEach((column, columnIndex) => {
      doc.setDrawColor(colors.border)
      doc.rect(currentX, context.cursorY, column.width, rowHeight)
      drawCellText(
        doc,
        cellLines[columnIndex] as string[],
        currentX,
        context.cursorY,
        column.width,
        rowHeight,
        column.align ?? "left"
      )
      currentX += column.width
    })

    context.cursorY += rowHeight
  })

  context.cursorY += 6
}

function drawTableHeader(context: PdfContext, columns: PdfTableColumn[]) {
  const { doc, marginX } = context
  const headerHeight = 8

  if (context.cursorY + headerHeight > context.pageHeight - context.bottomMargin) {
    addNewPage(context)
  }

  let currentX = marginX

  columns.forEach((column) => {
    doc.setFillColor(colors.accentSoft)
    doc.rect(currentX, context.cursorY, column.width, headerHeight, "F")
    doc.setDrawColor(colors.border)
    doc.rect(currentX, context.cursorY, column.width, headerHeight)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(8.5)
    doc.setTextColor(colors.accent)
    drawCellText(
      doc,
      [column.header],
      currentX,
      context.cursorY,
      column.width,
      headerHeight,
      column.align ?? "left"
    )
    currentX += column.width
  })

  context.cursorY += headerHeight
}

function drawCellText(
  doc: import("jspdf").jsPDF,
  lines: string[],
  x: number,
  y: number,
  width: number,
  rowHeight: number,
  align: "left" | "right" | "center"
) {
  doc.setFont("helvetica", "normal")
  doc.setFontSize(8.5)
  doc.setTextColor(colors.text)

  const lineHeight = 4
  const totalHeight = lines.length * lineHeight
  let textY = y + (rowHeight - totalHeight) / 2 + 3

  lines.forEach((line) => {
    if (align === "right") {
      doc.text(line, x + width - 1.5, textY, { align: "right" })
    } else if (align === "center") {
      doc.text(line, x + width / 2, textY, { align: "center" })
    } else {
      doc.text(line, x + 1.5, textY)
    }
    textY += lineHeight
  })
}

function drawRunningHeaderIfNeeded(context: PdfContext) {
  if (!context.hasRunningHeader) {
    context.hasRunningHeader = true
    return
  }

  if (context.cursorY <= context.topMargin + 1) {
    const { doc, marginX, contentWidth } = context
    doc.setFont("helvetica", "bold")
    doc.setFontSize(10)
    doc.setTextColor(colors.accent)
    doc.text(context.title, marginX, context.cursorY)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(8.5)
    doc.setTextColor(colors.muted)
    doc.text(context.periodLabel, marginX + contentWidth, context.cursorY, {
      align: "right",
    })
    context.cursorY += 6
  }
}

function startSectionOnNewPage(context: PdfContext) {
  if (context.cursorY > context.topMargin + 1) {
    addNewPage(context)
  }
}

function ensureSpace(context: PdfContext, height: number) {
  if (context.cursorY + height > context.pageHeight - context.bottomMargin) {
    addNewPage(context)
  }
}

function addNewPage(context: PdfContext) {
  context.doc.addPage()
  context.cursorY = context.topMargin
  context.hasRunningHeader = true
  drawRunningHeaderIfNeeded(context)
}

function addPageFooters(context: PdfContext) {
  const totalPages = context.doc.getNumberOfPages()
  const pageWidth = context.doc.internal.pageSize.getWidth()

  for (let page = 1; page <= totalPages; page += 1) {
    context.doc.setPage(page)
    context.doc.setFont("helvetica", "normal")
    context.doc.setFontSize(8)
    context.doc.setTextColor(colors.muted)
    context.doc.text(
      `${context.company.name} · Pagina ${page} de ${totalPages}`,
      pageWidth / 2,
      context.pageHeight - 5,
      { align: "center" }
    )
  }
}

async function loadImageAsDataUrl(path: string | null | undefined) {
  if (!path) {
    return null
  }

  if (path.startsWith("data:image/")) {
    return path
  }

  try {
    const response = await fetch(new URL(path, window.location.origin))
    if (!response.ok) {
      return null
    }

    const blob = await response.blob()

    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(new Error("Nao foi possivel ler o logo."))
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer)
  let binary = ""
  const chunkSize = 0x8000

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize)
    binary += String.fromCharCode(...chunk)
  }

  return btoa(binary)
}

function base64ToPdfBlob(base64: string) {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return new Blob([bytes], { type: "application/pdf" })
}

function toFiniteNumber(value: unknown) {
  const normalized = Number(value)
  return Number.isFinite(normalized) ? normalized : 0
}

function roundNumber(value: number) {
  return Math.round(value * 100) / 100
}
