import { Express, Request, Response } from "express";
import PDFDocument from "pdfkit";
import { getDb } from "./db";
import { appointments, barbers, services, commissions, branches, products, productSales, appointmentItems } from "../drizzle/schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";

export function registerPdfRoutes(app: Express) {
  app.get("/api/report/pdf", async (req: Request, res: Response) => {
    try {
      const branchId = parseInt(req.query.branchId as string);
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
      const barberId = req.query.barberId ? parseInt(req.query.barberId as string) : undefined;
      const paymentMethodFilter = req.query.paymentMethod as string | undefined;

      if (!branchId || isNaN(branchId)) {
        res.status(400).json({ error: "branchId é obrigatório" });
        return;
      }

      const db = await getDb();
      if (!db) {
        res.status(500).json({ error: "Erro de conexão com banco de dados" });
        return;
      }

      // Get branch info
      const [branch] = await db.select().from(branches).where(eq(branches.id, branchId));
      if (!branch) {
        res.status(404).json({ error: "Unidade não encontrada" });
        return;
      }

      // Build conditions for appointments query
      const conditions: any[] = [eq(appointments.branchId, branchId)];
      if (startDate) conditions.push(gte(appointments.appointmentDate, startDate));
      if (endDate) conditions.push(lte(appointments.appointmentDate, endDate));
      if (barberId && !isNaN(barberId)) conditions.push(eq(appointments.barberId, barberId));

      // Get barber name for individual report
      let barberName = "";
      if (barberId && !isNaN(barberId)) {
        const [barber] = await db.select().from(barbers).where(eq(barbers.id, barberId));
        barberName = barber?.name || "Barbeiro";
      }

      // Get appointments with barber and service names (LEFT JOIN on services to include product appointments)
      const data = await db
        .select({
          appointmentId: appointments.id,
          appointmentDate: appointments.appointmentDate,
          serviceId: appointments.serviceId,
          serviceName: services.name,
          servicePrice: appointments.servicePrice,
          discount: appointments.discount,
          finalPrice: appointments.finalPrice,
          tip: appointments.tip,
          barberName: barbers.name,
          barberCommission: appointments.barberCommission,
          commissionStatus: commissions.status,
          notes: appointments.notes,
          paymentMethod: appointments.paymentMethod,
          clientName: appointments.clientName,
        })
        .from(appointments)
        .innerJoin(barbers, eq(appointments.barberId, barbers.id))
        .leftJoin(services, eq(appointments.serviceId, services.id))
        .leftJoin(commissions, eq(commissions.appointmentId, appointments.id))
        .where(and(...conditions))
        .orderBy(appointments.appointmentDate);

      // For product appointments, get product names from product_sales
      // For service appointments with multiple items, expand into multiple rows
      const enrichedData: any[] = [];
      for (const row of data) {
        let tipo = "Serviço";
        let itemName = row.serviceName || "-";

        // Check if it's a product appointment (serviceId is null or notes starts with [Produto])
        if (!row.serviceId || (row.notes && row.notes.startsWith("[Produto]"))) {
          tipo = "Produto";
          // Try to get product name from product_sales
          const productSaleResult = await db
            .select({ productName: products.name })
            .from(productSales)
            .innerJoin(products, eq(productSales.productId, products.id))
            .where(eq(productSales.appointmentId, row.appointmentId))
            .limit(1);
          
          if (productSaleResult.length > 0) {
            itemName = productSaleResult[0].productName;
          } else if (row.notes) {
            const match = row.notes.match(/\[(Produto|Serviço)\]\s*(.+?)(?:\s*-\s*.*)?$/);
            if (match) {
              itemName = match[2].trim();
            }
          }
          enrichedData.push({ ...row, tipo, itemName, isFirstRow: true });
        } else {
          // Service appointment: check for extra items in appointment_items
          if (row.notes && row.notes.startsWith("[Serviço]")) {
            if (!row.serviceName) {
              const match = row.notes.match(/\[Serviço\]\s*(.+?)(?:\s*-\s*.*)?$/);
              if (match) itemName = match[1].trim();
            }
          }

          // Get extra items from appointment_items table
          const extraItems = await db
            .select()
            .from(appointmentItems)
            .where(eq(appointmentItems.appointmentId, row.appointmentId));

          // First row: main service
          enrichedData.push({ ...row, tipo, itemName, isFirstRow: true, hasExtraItems: extraItems.length > 0 });

          // Extra rows: one per extra service item
          for (const item of extraItems) {
            const itemPrice = parseFloat(item.servicePrice?.toString() || "0");
            const itemDiscount = parseFloat((item as any).discount?.toString() || "0");
            const itemNetPrice = Math.max(0, itemPrice - itemDiscount);
            const itemCommission = itemNetPrice > 0
              ? (itemNetPrice * parseFloat(item.commissionPercentage?.toString() || "0")) / 100
              : 0;
            enrichedData.push({
              ...row,
              tipo,
              itemName: item.serviceName,
              servicePrice: itemPrice,
              finalPrice: itemNetPrice,
              barberCommission: itemCommission,
              discount: itemDiscount,
              tip: 0,           // gorjeta só na primeira linha
              isFirstRow: false,
              isExtraItem: true,
            });
          }
        }
      }

      // Filter by payment method if specified
      const filteredData = paymentMethodFilter
        ? enrichedData.filter(row => row.paymentMethod === paymentMethodFilter)
        : enrichedData;

      // Calculate totals
      let totalFaturamento = 0;
      let totalComissao = 0;
      let totalLiquido = 0;
      let totalDesconto = 0;
      let totalGorjeta = 0;

      for (const row of filteredData) {
        const finalPrice = parseFloat(row.finalPrice?.toString() || "0");
        const commission = parseFloat(row.barberCommission?.toString() || "0");
        const discount = parseFloat(row.discount?.toString() || "0");
        const tip = parseFloat(row.tip?.toString() || "0");
        totalFaturamento += finalPrice;
        totalComissao += commission;
        totalDesconto += discount;
        totalGorjeta += tip;
        totalLiquido += finalPrice - commission;
      }

      // Generate PDF
      const doc = new PDFDocument({ 
        margin: 40, 
        size: "A4",
        layout: "landscape",
        bufferPages: true 
      });

      // Set response headers
      const dateStr = new Date().toISOString().split("T")[0];
      const filenameSuffix = barberName ? `-${barberName.replace(/\s+/g, '-')}` : "";
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename=relatorio-${branch.name.replace(/\s+/g, '-')}${filenameSuffix}-${dateStr}.pdf`);

      doc.pipe(res);

      // Colors
      const primaryColor = "#1e293b";
      const accentColor = "#3b82f6";
      const lightGray = "#f1f5f9";
      const darkGray = "#64748b";

      // Header
      doc.rect(0, 0, doc.page.width, 100).fill(primaryColor);
      const reportTitle = barberName ? `Relatório Individual - ${barberName}` : "Relatório de Produção";
      doc.fontSize(24).fillColor("#ffffff").text(reportTitle, 40, 25, { align: "left" });
      doc.fontSize(12).fillColor("#94a3b8").text(branch.name, 40, 55, { align: "left" });
      
      // Date range
      const periodText = startDate && endDate 
        ? `Período: ${startDate.toLocaleDateString("pt-BR")} a ${endDate.toLocaleDateString("pt-BR")}`
        : startDate 
          ? `A partir de: ${startDate.toLocaleDateString("pt-BR")}`
          : endDate
            ? `Até: ${endDate.toLocaleDateString("pt-BR")}`
            : "Todos os registros";
      doc.fontSize(10).fillColor("#94a3b8").text(periodText, 40, 75, { align: "left" });
      doc.fontSize(10).fillColor("#94a3b8").text(`Gerado em: ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR")}`, 40, 75, { align: "right" });

      let y = 120;

      // Summary Cards - now 5 cards with gorjeta
      const cardWidth = 140;
      const cardGap = 8;
      const startX = 40;

      doc.rect(startX, y, cardWidth, 60).fill(accentColor);
      doc.fontSize(8).fillColor("#ffffff").text("FATURAMENTO TOTAL", startX + 8, y + 10, { width: cardWidth - 16 });
      doc.fontSize(14).fillColor("#ffffff").text(`R$ ${totalFaturamento.toFixed(2)}`, startX + 8, y + 30, { width: cardWidth - 16 });

      doc.rect(startX + cardWidth + cardGap, y, cardWidth, 60).fill("#10b981");
      doc.fontSize(8).fillColor("#ffffff").text("VALOR LÍQUIDO", startX + cardWidth + cardGap + 8, y + 10, { width: cardWidth - 16 });
      doc.fontSize(14).fillColor("#ffffff").text(`R$ ${totalLiquido.toFixed(2)}`, startX + cardWidth + cardGap + 8, y + 30, { width: cardWidth - 16 });

      doc.rect(startX + (cardWidth + cardGap) * 2, y, cardWidth, 60).fill("#f59e0b");
      doc.fontSize(8).fillColor("#ffffff").text("COMISSÕES PAGAS", startX + (cardWidth + cardGap) * 2 + 8, y + 10, { width: cardWidth - 16 });
      doc.fontSize(14).fillColor("#ffffff").text(`R$ ${totalComissao.toFixed(2)}`, startX + (cardWidth + cardGap) * 2 + 8, y + 30, { width: cardWidth - 16 });

      doc.rect(startX + (cardWidth + cardGap) * 3, y, cardWidth, 60).fill("#8b5cf6");
      doc.fontSize(8).fillColor("#ffffff").text("GORJETAS", startX + (cardWidth + cardGap) * 3 + 8, y + 10, { width: cardWidth - 16 });
      doc.fontSize(14).fillColor("#ffffff").text(`R$ ${totalGorjeta.toFixed(2)}`, startX + (cardWidth + cardGap) * 3 + 8, y + 30, { width: cardWidth - 16 });

      doc.rect(startX + (cardWidth + cardGap) * 4, y, cardWidth, 60).fill("#ef4444");
      doc.fontSize(8).fillColor("#ffffff").text("DESCONTOS", startX + (cardWidth + cardGap) * 4 + 8, y + 10, { width: cardWidth - 16 });
      doc.fontSize(14).fillColor("#ffffff").text(`R$ ${totalDesconto.toFixed(2)}`, startX + (cardWidth + cardGap) * 4 + 8, y + 30, { width: cardWidth - 16 });

      y += 80;

      // Atendimentos count
      // Payment method filter label
      if (paymentMethodFilter) {
        const pmLabel = paymentMethodFilter === 'credit' ? 'Crédito' :
          paymentMethodFilter === 'debit' ? 'Débito' :
          paymentMethodFilter === 'pix' ? 'Pix' :
          paymentMethodFilter === 'cash' ? 'Dinheiro' : paymentMethodFilter;
        doc.fontSize(10).fillColor(accentColor).text(`Filtro: Pagamento via ${pmLabel}`, 40, y);
        y += 18;
      }

      doc.fontSize(12).fillColor(primaryColor).text(`Total de Atendimentos: ${filteredData.length}`, 40, y);
      y += 25;

      // Table Header - with Cliente and Gorjeta columns
      const colHeaders = ["Data", "Tipo", "Item", "Cliente", "Barbeiro", "Pgto", "Preço", "Desc.", "Gorjeta", "Comissão", "Líquido"];
      const colX =       [40,     95,     145,    290,        390,       465,    510,     555,     600,       645,        695];
      const colWidths =  [55,     50,     145,    100,        75,        45,     55,      45,      45,        50,         65];
      const tableWidth = 720;

      doc.rect(40, y, tableWidth, 22).fill(primaryColor);
      doc.fontSize(7.5).fillColor("#ffffff");
      for (let i = 0; i < colHeaders.length; i++) {
        doc.text(colHeaders[i], colX[i], y + 6, { width: colWidths[i], align: "left" });
      }
      y += 22;

      // Table Rows
      doc.fontSize(7.5).fillColor(primaryColor);
      for (let idx = 0; idx < filteredData.length; idx++) {
        const row = filteredData[idx];
        
        // Check if we need a new page
        if (y > 520) {
          doc.addPage();
          y = 40;
          // Repeat header
          doc.rect(40, y, tableWidth, 22).fill(primaryColor);
          doc.fontSize(7.5).fillColor("#ffffff");
          for (let i = 0; i < colHeaders.length; i++) {
            doc.text(colHeaders[i], colX[i], y + 6, { width: colWidths[i], align: "left" });
          }
          y += 22;
          doc.fillColor(primaryColor);
        }

        // Alternate row background
        if (idx % 2 === 0) {
          doc.rect(40, y, tableWidth, 18).fill(lightGray);
        }

        const finalPrice = parseFloat(row.finalPrice?.toString() || "0");
        const commission = parseFloat(row.barberCommission?.toString() || "0");
        const discount = parseFloat(row.discount?.toString() || "0");
        const tip = parseFloat(row.tip?.toString() || "0");
        const liquido = finalPrice - commission;

        doc.fontSize(7.5).fillColor(primaryColor);
        const dateFormatted = row.appointmentDate 
          ? new Date(row.appointmentDate).toLocaleDateString("pt-BR") 
          : "-";
        
        // Tipo badge color
        const tipoColor = row.tipo === "Produto" ? "#8b5cf6" : "#3b82f6";
        
        const paymentLabel = row.paymentMethod === 'credit' ? 'Créd' :
          row.paymentMethod === 'debit' ? 'Déb' :
          row.paymentMethod === 'pix' ? 'Pix' :
          row.paymentMethod === 'cash' ? 'Din' : '-';
        const paymentColor = row.paymentMethod === 'credit' ? '#8b5cf6' :
          row.paymentMethod === 'debit' ? '#3b82f6' :
          row.paymentMethod === 'pix' ? '#10b981' :
          row.paymentMethod === 'cash' ? '#f59e0b' : darkGray;

        // For extra items (2nd+ service): repeat cliente, barbeiro, pgto, show item-level discount, commission, liquido
        // Gorjeta only on first row
        const isExtraItem = (row as any).isExtraItem;
        const clientNameDisplay = (row as any).clientName || "-";

        doc.text(isExtraItem ? "" : dateFormatted, colX[0], y + 5, { width: colWidths[0] });
        doc.fillColor(isExtraItem ? "#94a3b8" : tipoColor).text(isExtraItem ? "  +" : row.tipo, colX[1], y + 5, { width: colWidths[1] });
        doc.fillColor(primaryColor).text(row.itemName || "-", colX[2], y + 5, { width: colWidths[2] });
        // Cliente: repeat on every row
        doc.text(clientNameDisplay, colX[3], y + 5, { width: colWidths[3] });
        // Barbeiro: repeat on every row
        doc.text(row.barberName || "-", colX[4], y + 5, { width: colWidths[4] });
        // Pgto: repeat on every row
        doc.fillColor(paymentColor).text(paymentLabel, colX[5], y + 5, { width: colWidths[5] });
        // Preço do item (já descontado para extras)
        doc.fillColor(primaryColor).text(`R$ ${finalPrice.toFixed(2)}`, colX[6], y + 5, { width: colWidths[6] });
        // Desconto: por item (extras têm desconto próprio; gorjeta só na primeira linha)
        doc.text(discount > 0 ? `R$ ${discount.toFixed(2)}` : "-", colX[7], y + 5, { width: colWidths[7] });
        // Gorjeta: só na primeira linha do atendimento
        doc.fillColor("#8b5cf6").text(isExtraItem ? "-" : (tip > 0 ? `R$ ${tip.toFixed(2)}` : "-"), colX[8], y + 5, { width: colWidths[8] });
        // Comissão por item
        doc.fillColor("#ef4444").text(`R$ ${commission.toFixed(2)}`, colX[9], y + 5, { width: colWidths[9] });
        // Líquido por item = finalPrice - commission
        doc.fillColor("#10b981").text(`R$ ${liquido.toFixed(2)}`, colX[10], y + 5, { width: colWidths[10] });
        doc.fillColor(primaryColor);

        y += 18;
      }

      // If no data
      if (filteredData.length === 0) {
        y += 20;
        doc.fontSize(12).fillColor(darkGray).text("Nenhum atendimento encontrado para o período selecionado.", 40, y, { align: "center" });
      }

      // Footer
      y += 30;
      if (y > 520) {
        doc.addPage();
        y = 40;
      }

      doc.rect(40, y, tableWidth, 1).fill(darkGray);
      y += 10;
      doc.fontSize(8).fillColor(darkGray).text("Barbearia Control - Sistema de Controle de Produção", 40, y, { align: "center" });
      doc.fontSize(7).fillColor(darkGray).text("Relatório gerado automaticamente", 40, y + 12, { align: "center" });

      doc.end();
    } catch (error: any) {
      console.error("Erro ao gerar PDF:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Erro ao gerar relatório PDF" });
      }
    }
  });
}
