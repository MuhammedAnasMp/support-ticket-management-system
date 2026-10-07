import React, { useRef, useState, useMemo } from "react";

// --- Types ---
export interface ExpenseEntry {
    sl: number;
    outlet: string;
    category: "Warehouses & Logistics" | "Staff Accommodations" | "Retail Outlets" | "Corporate";
    location: string;
    labour: number;
    material: number;
    other: number;
    remark: string;
}

export interface AssetEntry {
    sl: number;
    outlet: string;
    labour: number;
    material: number;
    other: number;
    remark: string;
}

export default function Test() {
    const [viewMode, setViewMode] = useState<"consolidated" | "byDepartment" | "activeOnly">("consolidated");
    const [isGenerating, setIsGenerating] = useState(false);
    const printSheetRef = useRef<HTMLDivElement>(null);

    // Exact data from June 2026 sheet
    const maintenanceData: ExpenseEntry[] = [
        { sl: 1, outlet: "MINABDULLA OLD WAREHOUSE", category: "Warehouses & Logistics", location: "Mina Abdulla", labour: 0.0, material: 0.0, other: 0.0, remark: "" },
        { sl: 2, outlet: "NEW WAREHOUSE", category: "Warehouses & Logistics", location: "Industrial", labour: 0.0, material: 0.0, other: 0.0, remark: "" },
        { sl: 3, outlet: "CENTRAL KITCHEN", category: "Warehouses & Logistics", location: "Sabhan", labour: 33.0, material: 2.25, other: 0.0, remark: "" },
        { sl: 4, outlet: "QURAIN MESS", category: "Warehouses & Logistics", location: "Qurain", labour: 0.0, material: 0.0, other: 0.0, remark: "" },
        { sl: 5, outlet: "FAHAHEEL CAMP", category: "Staff Accommodations", location: "Fahaheel", labour: 0.0, material: 0.0, other: 0.0, remark: "" },
        { sl: 6, outlet: "MAHBOULA CAMP", category: "Staff Accommodations", location: "Mahboula", labour: 66.0, material: 85.75, other: 0.0, remark: "VACANT ON NEPALI STAFF ACCOMODATION PAINTING AND CARPENTARY WORK ." },
        { sl: 7, outlet: "MAHBOULA LADIES CAMP", category: "Staff Accommodations", location: "Mahboula", labour: 22.0, material: 31.5, other: 0.0, remark: "" },
        { sl: 8, outlet: "FARWANIYA LADIES CAMP", category: "Staff Accommodations", location: "Farwaniya", labour: 0.0, material: 0.0, other: 0.0, remark: "" },
        { sl: 9, outlet: "FARWANIYA CAMP", category: "Staff Accommodations", location: "Farwaniya", labour: 79.2, material: 0.0, other: 0.0, remark: "" },
        { sl: 10, outlet: "FARWANIYA NEPALI CAMP", category: "Staff Accommodations", location: "Farwaniya", labour: 0.0, material: 0.0, other: 0.0, remark: "" },
        { sl: 11, outlet: "HAWALLY LADIES CAMP", category: "Staff Accommodations", location: "Hawally", labour: 0.0, material: 0.0, other: 0.0, remark: "" },
        { sl: 12, outlet: "HAWALLY CAMP", category: "Staff Accommodations", location: "Hawally", labour: 0.0, material: 0.0, other: 0.0, remark: "" },
        { sl: 13, outlet: "HAWALLY CAMP2", category: "Staff Accommodations", location: "Hawally", labour: 0.0, material: 0.0, other: 0.0, remark: "" },
        { sl: 14, outlet: "EGAILA", category: "Retail Outlets", location: "Egaila", labour: 4.4, material: 7.25, other: 0.0, remark: "" },
        { sl: 15, outlet: "FAHAHEEL", category: "Retail Outlets", location: "Fahaheel", labour: 195.8, material: 175.6, other: 0.0, remark: "FIRE EXIT STAIR CASE AREA OUTSIDE AND INSIDE PILLER PAINTING WORK .CASH COUNTER AREA GARMENTS AREA SLAT BOARD FIXING WORK AND CEILING NON FOOD PALLET WORK" },
        { sl: 16, outlet: "FAHAHEEL 2", category: "Retail Outlets", location: "Fahaheel", labour: 0.0, material: 0.0, other: 0.0, remark: "" },
        { sl: 17, outlet: "FAHAHEEL FRESH", category: "Retail Outlets", location: "Fahaheel", labour: 0.0, material: 0.0, other: 0.0, remark: "" },
        { sl: 18, outlet: "ABU HALIFA FRESH", category: "Retail Outlets", location: "Abu Halifa", labour: 0.0, material: 0.0, other: 0.0, remark: "" },
        { sl: 19, outlet: "MANGAF GRAND", category: "Retail Outlets", location: "Mangaf", labour: 79.2, material: 29.25, other: 0.0, remark: "BACK STORE AREAWALL TILE WORK AT HOTFOOD" },
        { sl: 20, outlet: "MANGAF FRESH", category: "Retail Outlets", location: "Mangaf", labour: 0.0, material: 0.0, other: 0.0, remark: "" },
        { sl: 21, outlet: "MANGAF FRESH 2", category: "Retail Outlets", location: "Mangaf", labour: 0.0, material: 0.0, other: 0.0, remark: "" },
        { sl: 22, outlet: "MAHBOULA-1", category: "Retail Outlets", location: "Mahboula", labour: 44.0, material: 26.75, other: 0.0, remark: "ROASTERY AREA GLASSMWORK, ADDITIONAL GLASS FOR CHOCLATES AND NUTS" },
        { sl: 23, outlet: "MAHBOULA-2", category: "Retail Outlets", location: "Mahboula", labour: 44.0, material: 32.0, other: 0.0, remark: "ADDITIONAL GLASS FOR CHOCLATES AND NUTS AND PALLET WORK FOR FOOD" },
        { sl: 24, outlet: "COSTO MAHBOULA", category: "Retail Outlets", location: "Mahboula", labour: 44.0, material: 0.0, other: 0.0, remark: "" },
        { sl: 25, outlet: "QURAIN HYPER", category: "Retail Outlets", location: "Qurain", labour: 16.5, material: 0.0, other: 0.0, remark: "" },
        { sl: 26, outlet: "COSTO KHAITAN", category: "Retail Outlets", location: "Khaitan", labour: 0.0, material: 0.0, other: 0.0, remark: "" },
        { sl: 27, outlet: "KHAITAN", category: "Retail Outlets", location: "Khaitan", labour: 0.0, material: 0.0, other: 0.0, remark: "" },
        { sl: 28, outlet: "KHAITAN FRESH", category: "Retail Outlets", location: "Khaitan", labour: 0.0, material: 0.0, other: 0.0, remark: "" },
        { sl: 29, outlet: "FARWANIYA-1", category: "Retail Outlets", location: "Farwaniya", labour: 42.9, material: 75.75, other: 0.0, remark: "BUTCHERY AND FISHERY AREA WALL TILE WORK.ROASTERY F&V AND NON FOOD AREA CEILING WORK" },
        { sl: 30, outlet: "FARWANIYA-2", category: "Retail Outlets", location: "Farwaniya", labour: 1.1, material: 4.0, other: 0.0, remark: "" },
        { sl: 31, outlet: "FARWANIYA-3", category: "Retail Outlets", location: "Farwaniya", labour: 6.6, material: 0.0, other: 0.0, remark: "" },
        { sl: 32, outlet: "FARWANIYA FRESH", category: "Retail Outlets", location: "Farwaniya", labour: 0.0, material: 0.0, other: 0.0, remark: "" },
        { sl: 33, outlet: "SABAH SALEM", category: "Retail Outlets", location: "Sabah Salem", labour: 15.4, material: 2.5, other: 0.0, remark: "" },
        { sl: 34, outlet: "JLEEB", category: "Retail Outlets", location: "Jleeb Al-Shuyoukh", labour: 66.0, material: 4.0, other: 0.0, remark: "FIRE CURTIAN CLOSING WALL WITH BLOCK WORK. OBSTACLES REMOVING ON FIRE CURTAIN AREA" },
        { sl: 35, outlet: "JLEEB 2", category: "Retail Outlets", location: "Jleeb Al-Shuyoukh", labour: 0.0, material: 0.0, other: 0.0, remark: "" },
        { sl: 36, outlet: "HASSAWI", category: "Retail Outlets", location: "Hassawi", labour: 33.0, material: 87.0, other: 0.0, remark: "FOOD AND NON FOOD AREA ADDITIONAL PALLET WORK." },
        { sl: 37, outlet: "RIGGAE", category: "Retail Outlets", location: "Riggae", labour: 0.0, material: 0.0, other: 0.0, remark: "" },
        { sl: 38, outlet: "RIGGAE 2", category: "Retail Outlets", location: "Riggae", labour: 0.0, material: 0.0, other: 0.0, remark: "" },
        { sl: 39, outlet: "JAHRA", category: "Retail Outlets", location: "Jahra", labour: 11.0, material: 0.0, other: 0.0, remark: "" },
        { sl: 40, outlet: "JAHRA 2", category: "Retail Outlets", location: "Jahra", labour: 8.8, material: 18.0, other: 0.0, remark: "" },
        { sl: 41, outlet: "SULAIBIYA", category: "Retail Outlets", location: "Sulaibiya", labour: 4.4, material: 8.44, other: 0.0, remark: "" },
        { sl: 42, outlet: "AL RAI", category: "Retail Outlets", location: "Al Rai", labour: 13.2, material: 2.25, other: 0.0, remark: "" },
        { sl: 43, outlet: "SHUWAIKH", category: "Retail Outlets", location: "Shuwaikh", labour: 1.1, material: 16.0, other: 0.0, remark: "ENTRANCE AREA FLAIR BOARD ACRALIC SHEET CHANGED" },
        { sl: 44, outlet: "CITY GRAND", category: "Retail Outlets", location: "Kuwait City", labour: 0.0, material: 0.0, other: 0.0, remark: "" },
        { sl: 45, outlet: "WATIA TOWER", category: "Retail Outlets", location: "Kuwait City", labour: 0.0, material: 0.0, other: 0.0, remark: "" },
        { sl: 46, outlet: "SOUK AL KABEER", category: "Retail Outlets", location: "Kuwait City", labour: 0.0, material: 0.0, other: 0.0, remark: "" },
        { sl: 47, outlet: "SOUK AL MASEEL", category: "Retail Outlets", location: "Kuwait City", labour: 0.0, material: 0.0, other: 0.0, remark: "" },
        { sl: 48, outlet: "MURGAB", category: "Retail Outlets", location: "Murgab", labour: 0.0, material: 0.0, other: 0.0, remark: "" },
        { sl: 49, outlet: "SHAAB", category: "Retail Outlets", location: "Shaab", labour: 1.1, material: 1.75, other: 0.0, remark: "" },
        { sl: 50, outlet: "SALMIYA-1", category: "Retail Outlets", location: "Salmiya", labour: 0.0, material: 0.0, other: 0.0, remark: "" },
        { sl: 51, outlet: "SALMIYA-2", category: "Retail Outlets", location: "Salmiya", labour: 0.0, material: 0.0, other: 0.0, remark: "" },
        { sl: 52, outlet: "SALMIYA FRESH", category: "Retail Outlets", location: "Salmiya", labour: 0.0, material: 0.0, other: 0.0, remark: "" },
        { sl: 53, outlet: "SALMIYA FRESH B12", category: "Retail Outlets", location: "Salmiya", labour: 0.0, material: 0.0, other: 0.0, remark: "" },
        { sl: 54, outlet: "SALMIYA FRESH B11", category: "Retail Outlets", location: "Salmiya", labour: 0.0, material: 0.0, other: 0.0, remark: "" },
        { sl: 55, outlet: "SALMIYA FRESH B10", category: "Retail Outlets", location: "Salmiya", labour: 11.0, material: 32.5, other: 0.0, remark: "ENTRANCE AREA PLASTIC CURTAIN FIXED" },
        { sl: 56, outlet: "SALWA", category: "Retail Outlets", location: "Salwa", labour: 22.0, material: 5.0, other: 0.0, remark: "" },
        { sl: 57, outlet: "HAWALLY-1", category: "Retail Outlets", location: "Hawally", labour: 37.4, material: 34.25, other: 0.0, remark: "HOT FOOD AREA BACK WALL SS SHEET FIXING , ACRALIC SHEET FOR DOOR ON BAIN MARIE" },
        { sl: 58, outlet: "HAWALLY-2", category: "Retail Outlets", location: "Hawally", labour: 24.2, material: 7.0, other: 0.0, remark: "HOT FOOD AREA BAIN MARIE DOOR FIXING WORK" },
        { sl: 59, outlet: "HAWALLY-3", category: "Retail Outlets", location: "Hawally", labour: 15.4, material: 8.45, other: 0.0, remark: "ROASTERY CHANGED TO NEW LOCATION WORK" },
        { sl: 60, outlet: "HAWALLY-5", category: "Retail Outlets", location: "Hawally", labour: 0.0, material: 0.0, other: 0.0, remark: "" },
        { sl: 61, outlet: "HAWALLY-6", category: "Retail Outlets", location: "Hawally", labour: 0.0, material: 0.0, other: 0.0, remark: "" },
        { sl: 62, outlet: "JAMAL DOOSARI", category: "Retail Outlets", location: "Hawally", labour: 0.0, material: 0.0, other: 0.0, remark: "" },
        { sl: 63, outlet: "CORPORATE", category: "Corporate", location: "Head Office", labour: 49.5, material: 25.25, other: 0.0, remark: "" },
    ];

    // Table 2: Asset data
    const assetData: AssetEntry[] = [
        {
            sl: 1,
            outlet: "HASSAWI",
            labour: 44.0,
            material: 152.5,
            other: 132.0,
            remark: "ELECTRONICS ENTRANCE AREA,LIFT AREA AND CASH COUNTER AREA BLOCK WALL WORK FOR MATHAFI ISSUE",
        },
    ];

    const formatAmount = (num: number) => num.toFixed(3);

    // Totals for Table 1
    const maintTotals = useMemo(() => {
        return maintenanceData.reduce(
            (acc, cur) => ({
                labour: acc.labour + cur.labour,
                material: acc.material + cur.material,
                other: acc.other + cur.other,
                total: acc.total + (cur.labour + cur.material + cur.other),
            }),
            { labour: 0, material: 0, other: 0, total: 0 }
        );
    }, [maintenanceData]);

    // Totals for Table 2
    const assetTotals = useMemo(() => {
        return assetData.reduce(
            (acc, cur) => ({
                labour: acc.labour + cur.labour,
                material: acc.material + cur.material,
                other: acc.other + cur.other,
                total: acc.total + (cur.labour + cur.material + cur.other),
            }),
            { labour: 0, material: 0, other: 0, total: 0 }
        );
    }, [assetData]);

    // Filtered rows for on-screen view
    const displayedRows = useMemo(() => {
        if (viewMode === "activeOnly") {
            return maintenanceData.filter((r) => r.labour > 0 || r.material > 0 || r.other > 0);
        }
        return maintenanceData;
    }, [viewMode, maintenanceData]);

    // Row-aware multi-page PDF generation: Never cuts a row in half
    const handleDownloadPdf = async () => {
        if (!printSheetRef.current) return;
        setIsGenerating(true);

        try {
            if (document.fonts) await document.fonts.ready;

            const html2canvas = (await import("html2canvas")).default;
            const { jsPDF } = await import("jspdf");

            const element = printSheetRef.current;
            const canvas = await html2canvas(element, {
                scale: 2,
                useCORS: true,
                logging: false,
                backgroundColor: "#ffffff",
                windowWidth: element.offsetWidth,
            });

            const pdf = new jsPDF("p", "mm", "a4");
            const pdfWidth = 210;
            const pdfHeight = 297;
            const elementWidth = element.offsetWidth;
            const canvasScale = canvas.width / elementWidth;

            // Maximum page height in DOM coordinates (leaving a 10mm margin top and bottom)
            const marginMm = 8;
            const usablePdfHeight = pdfHeight - marginMm * 2;
            const maxPageHeightDom = elementWidth * (usablePdfHeight / pdfWidth);

            // Collect all row bounding tops and bottoms relative to the container
            const containerRect = element.getBoundingClientRect();
            const splitNodes = Array.from(element.querySelectorAll("tr, .section-title"));
            const splitBottoms = splitNodes
                .map((node) => node.getBoundingClientRect().bottom - containerRect.top)
                .filter((b) => b > 0);

            const totalDomHeight = element.scrollHeight;
            let currentDomY = 0;
            let pageIndex = 0;

            while (currentDomY < totalDomHeight) {
                const targetBottom = currentDomY + maxPageHeightDom;

                // Pick the last row that fully fits on the current page
                let splitY = targetBottom;
                if (targetBottom < totalDomHeight) {
                    const candidate = splitBottoms.filter((b) => b <= targetBottom && b > currentDomY).pop();
                    if (candidate) {
                        splitY = candidate;
                    }
                } else {
                    splitY = totalDomHeight;
                }

                const sliceHeightDom = splitY - currentDomY;
                if (sliceHeightDom <= 0) break;

                const sliceCanvasY = currentDomY * canvasScale;
                const sliceCanvasH = sliceHeightDom * canvasScale;

                // Create a temporary canvas containing only this page slice
                const pageCanvas = document.createElement("canvas");
                pageCanvas.width = canvas.width;
                pageCanvas.height = sliceCanvasH;
                const pCtx = pageCanvas.getContext("2d");

                if (pCtx) {
                    pCtx.fillStyle = "#ffffff";
                    pCtx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
                    pCtx.drawImage(
                        canvas,
                        0,
                        sliceCanvasY,
                        canvas.width,
                        sliceCanvasH,
                        0,
                        0,
                        canvas.width,
                        sliceCanvasH
                    );

                    const pageImg = pageCanvas.toDataURL("image/png");
                    const slicePdfHeight = (sliceHeightDom / elementWidth) * pdfWidth;

                    if (pageIndex > 0) {
                        pdf.addPage();
                    }
                    pdf.addImage(pageImg, "PNG", 0, marginMm, pdfWidth, slicePdfHeight);
                    pageIndex++;
                }

                currentDomY = splitY;
            }

            pdf.save(`Consolidation_June_2026.pdf`);
        } catch (err) {
            console.error(err);
            alert("Failed to export PDF.");
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div style={{ backgroundColor: "#e5e7eb", minHeight: "100vh", padding: "20px", fontFamily: "Calibri, Arial, sans-serif" }}>
            {/* CSS Print Styles for Direct Native Browser Printing */}
            <style dangerouslySetInnerHTML={{
                __html: `
                @media print {
                    body {
                        background-color: #ffffff !important;
                        padding: 0 !important;
                        margin: 0 !important;
                    }
                    .no-print {
                        display: none !important;
                    }
                    #print-sheet {
                        width: 100% !important;
                        box-shadow: none !important;
                        border: none !important;
                        padding: 0 !important;
                        margin: 0 !important;
                    }
                    tr {
                        page-break-inside: avoid !important;
                        break-inside: avoid !important;
                    }
                }
            `}} />

            {/* Top Action Toolbar */}
            <div className="no-print" style={{ maxWidth: "1050px", margin: "0 auto 16px auto", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
                <div style={{ display: "flex", gap: "8px" }}>
                    <button
                        onClick={() => setViewMode("consolidated")}
                        style={{
                            padding: "8px 14px",
                            backgroundColor: viewMode === "consolidated" ? "#1e293b" : "#fff",
                            color: viewMode === "consolidated" ? "#fff" : "#1e293b",
                            border: "1px solid #cbd5e1",
                            borderRadius: "4px",
                            fontWeight: 600,
                            cursor: "pointer",
                        }}
                    >
                        Original Document (1 - 63)
                    </button>
                    <button
                        onClick={() => setViewMode("byDepartment")}
                        style={{
                            padding: "8px 14px",
                            backgroundColor: viewMode === "byDepartment" ? "#1e293b" : "#fff",
                            color: viewMode === "byDepartment" ? "#fff" : "#1e293b",
                            border: "1px solid #cbd5e1",
                            borderRadius: "4px",
                            fontWeight: 600,
                            cursor: "pointer",
                        }}
                    >
                        ★ Separate by Sub-Department
                    </button>
                    <button
                        onClick={() => setViewMode("activeOnly")}
                        style={{
                            padding: "8px 14px",
                            backgroundColor: viewMode === "activeOnly" ? "#1e293b" : "#fff",
                            color: viewMode === "activeOnly" ? "#fff" : "#1e293b",
                            border: "1px solid #cbd5e1",
                            borderRadius: "4px",
                            fontWeight: 600,
                            cursor: "pointer",
                        }}
                    >
                        Non-Zero Only
                    </button>
                </div>

                <div style={{ display: "flex", gap: "8px" }}>
                    <button
                        onClick={() => window.print()}
                        style={{
                            padding: "8px 14px",
                            backgroundColor: "#3b82f6",
                            color: "#fff",
                            border: "none",
                            borderRadius: "4px",
                            fontWeight: "bold",
                            cursor: "pointer",
                        }}
                    >
                        🖨️ Native Print / PDF
                    </button>
                    <button
                        onClick={handleDownloadPdf}
                        disabled={isGenerating}
                        style={{
                            padding: "8px 18px",
                            backgroundColor: isGenerating ? "#9ca3af" : "#059669",
                            color: "#fff",
                            border: "none",
                            borderRadius: "4px",
                            fontWeight: "bold",
                            cursor: isGenerating ? "not-allowed" : "pointer",
                        }}
                    >
                        {isGenerating ? "Rendering PDF..." : "📥 Download Clean PDF"}
                    </button>
                </div>
            </div>

            {/* ========================================================= */}
            {/* EXCEL SHEET CONTAINER                                     */}
            {/* ========================================================= */}
            <div
                id="print-sheet"
                ref={printSheetRef}
                style={{
                    width: "1050px",
                    margin: "0 auto",
                    backgroundColor: "#ffffff",
                    padding: "24px 30px",
                    border: "1px solid #9ca3af",
                    boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
                    boxSizing: "border-box",
                }}
            >
                {/* Document Main Heading */}
                <div className="section-title" style={{ textAlign: "center", marginBottom: "6px" }}>
                    <span style={{ fontSize: "14px", fontWeight: "bold", textDecoration: "underline", letterSpacing: "1px" }}>
                        CONSOLIDATION
                    </span>
                </div>

                {/* Table 1 Subtitle Bar */}
                <div
                    className="section-title"
                    style={{
                        backgroundColor: "#d9d9d9",
                        border: "1px solid #000",
                        borderBottom: "none",
                        textAlign: "center",
                        padding: "5px",
                        fontWeight: "bold",
                        fontSize: "12px",
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                    }}
                >
                    GRAND CIVIL & CARPENTRY MAINTENANCE COST FOR THE MONTH JUNE 2026
                </div>

                {/* Table 1: Maintenance Cost Consolidation */}
                <table
                    style={{
                        width: "100%",
                        borderCollapse: "separate",
                        borderSpacing: 0,
                        fontSize: "10px",
                        borderTop: "1px solid #000",
                        borderLeft: "1px solid #000",
                        boxSizing: "border-box",
                    }}
                >
                    <thead>
                        <tr style={{ backgroundColor: "#efefef", textAlign: "center" }}>
                            <th style={{ borderRight: "1px solid #000", borderBottom: "1px solid #000", width: "35px", padding: "5px 3px" }}>SL</th>
                            <th style={{ borderRight: "1px solid #000", borderBottom: "1px solid #000", width: "180px", padding: "5px" }}>OUTLET</th>
                            <th style={{ borderRight: "1px solid #000", borderBottom: "1px solid #000", width: "70px", padding: "5px" }}>LABOUR CHARGE</th>
                            <th style={{ borderRight: "1px solid #000", borderBottom: "1px solid #000", width: "70px", padding: "5px" }}>MATERIAL CHARGE</th>
                            <th style={{ borderRight: "1px solid #000", borderBottom: "1px solid #000", width: "65px", padding: "5px" }}>OTHER CHARGES</th>
                            <th style={{ borderRight: "1px solid #000", borderBottom: "1px solid #000", width: "75px", padding: "5px" }}>TOTAL AMOUNT</th>
                            <th style={{ borderRight: "1px solid #000", borderBottom: "1px solid #000", padding: "5px" }}>REMARK</th>
                        </tr>
                    </thead>
                    <tbody>
                        {viewMode === "byDepartment" ? (
                            (["Warehouses & Logistics", "Staff Accommodations", "Retail Outlets", "Corporate"] as const).map((dept) => {
                                const groupRows = maintenanceData.filter((r) => r.category === dept);
                                const gLabour = groupRows.reduce((a, b) => a + b.labour, 0);
                                const gMaterial = groupRows.reduce((a, b) => a + b.material, 0);
                                const gOther = groupRows.reduce((a, b) => a + b.other, 0);
                                const gTotal = gLabour + gMaterial + gOther;

                                return (
                                    <React.Fragment key={dept}>
                                        <tr style={{ backgroundColor: "#e2e8f0", fontWeight: "bold" }}>
                                            <td colSpan={2} style={{ borderRight: "1px solid #000", borderBottom: "1px solid #000", padding: "5px 8px", verticalAlign: "middle" }}>
                                                ▶ SUB-DEPARTMENT: {dept.toUpperCase()}
                                            </td>
                                            <td style={{ borderRight: "1px solid #000", borderBottom: "1px solid #000", textAlign: "right", padding: "5px", verticalAlign: "middle" }}>{formatAmount(gLabour)}</td>
                                            <td style={{ borderRight: "1px solid #000", borderBottom: "1px solid #000", textAlign: "right", padding: "5px", verticalAlign: "middle" }}>{formatAmount(gMaterial)}</td>
                                            <td style={{ borderRight: "1px solid #000", borderBottom: "1px solid #000", textAlign: "center", padding: "5px", verticalAlign: "middle" }}>-</td>
                                            <td style={{ borderRight: "1px solid #000", borderBottom: "1px solid #000", textAlign: "right", padding: "5px", verticalAlign: "middle" }}>{formatAmount(gTotal)}</td>
                                            <td style={{ borderRight: "1px solid #000", borderBottom: "1px solid #000", padding: "5px 8px", fontStyle: "italic", color: "#475569", verticalAlign: "middle" }}>
                                                Subtotal for {groupRows.length} locations
                                            </td>
                                        </tr>
                                        {groupRows.map((row) => {
                                            const rowTotal = row.labour + row.material + row.other;
                                            return (
                                                <tr key={row.sl}>
                                                    <td style={{ borderRight: "1px solid #000", borderBottom: "1px solid #000", textAlign: "center", padding: "3px", verticalAlign: "middle" }}>{row.sl}</td>
                                                    <td style={{ borderRight: "1px solid #000", borderBottom: "1px solid #000", padding: "3px 6px", textTransform: "uppercase", verticalAlign: "middle" }}>{row.outlet}</td>
                                                    <td style={{ borderRight: "1px solid #000", borderBottom: "1px solid #000", textAlign: "right", padding: "3px 6px", verticalAlign: "middle" }}>{formatAmount(row.labour)}</td>
                                                    <td style={{ borderRight: "1px solid #000", borderBottom: "1px solid #000", textAlign: "right", padding: "3px 6px", verticalAlign: "middle" }}>{formatAmount(row.material)}</td>
                                                    <td style={{ borderRight: "1px solid #000", borderBottom: "1px solid #000", textAlign: "center", padding: "3px 6px", verticalAlign: "middle" }}>-</td>
                                                    <td style={{ borderRight: "1px solid #000", borderBottom: "1px solid #000", textAlign: "right", padding: "3px 6px", verticalAlign: "middle" }}>{formatAmount(rowTotal)}</td>
                                                    <td style={{ borderRight: "1px solid #000", borderBottom: "1px solid #000", padding: "3px 6px", fontSize: "9px", lineHeight: "1.25", verticalAlign: "middle" }}>{row.remark}</td>
                                                </tr>
                                            );
                                        })}
                                    </React.Fragment>
                                );
                            })
                        ) : (
                            displayedRows.map((row) => {
                                const rowTotal = row.labour + row.material + row.other;
                                return (
                                    <tr key={row.sl}>
                                        <td style={{ borderRight: "1px solid #000", borderBottom: "1px solid #000", textAlign: "center", padding: "3px", verticalAlign: "middle" }}>{row.sl}</td>
                                        <td style={{ borderRight: "1px solid #000", borderBottom: "1px solid #000", padding: "3px 6px", textTransform: "uppercase", verticalAlign: "middle", whiteSpace: "nowrap" }}>{row.outlet}</td>
                                        <td style={{ borderRight: "1px solid #000", borderBottom: "1px solid #000", textAlign: "right", padding: "3px 6px", verticalAlign: "middle" }}>{formatAmount(row.labour)}</td>
                                        <td style={{ borderRight: "1px solid #000", borderBottom: "1px solid #000", textAlign: "right", padding: "3px 6px", verticalAlign: "middle" }}>{formatAmount(row.material)}</td>
                                        <td style={{ borderRight: "1px solid #000", borderBottom: "1px solid #000", textAlign: "center", padding: "3px 6px", verticalAlign: "middle" }}>-</td>
                                        <td style={{ borderRight: "1px solid #000", borderBottom: "1px solid #000", textAlign: "right", padding: "3px 6px", verticalAlign: "middle" }}>{formatAmount(rowTotal)}</td>
                                        <td style={{ borderRight: "1px solid #000", borderBottom: "1px solid #000", padding: "3px 6px", fontSize: "9px", lineHeight: "1.25", verticalAlign: "middle" }}>{row.remark}</td>
                                    </tr>
                                );
                            })
                        )}

                        {/* Table 1 Total Row */}
                        <tr style={{ backgroundColor: "#efefef", fontWeight: "bold" }}>
                            <td colSpan={2} style={{ borderRight: "1px solid #000", borderBottom: "1px solid #000", textAlign: "center", padding: "5px", verticalAlign: "middle" }}>TOTAL</td>
                            <td style={{ borderRight: "1px solid #000", borderBottom: "1px solid #000", textAlign: "right", padding: "5px 6px", verticalAlign: "middle" }}>{formatAmount(maintTotals.labour)}</td>
                            <td style={{ borderRight: "1px solid #000", borderBottom: "1px solid #000", textAlign: "right", padding: "5px 6px", verticalAlign: "middle" }}>{formatAmount(maintTotals.material)}</td>
                            <td style={{ borderRight: "1px solid #000", borderBottom: "1px solid #000", textAlign: "center", padding: "5px 6px", verticalAlign: "middle" }}>0.000</td>
                            <td style={{ borderRight: "1px solid #000", borderBottom: "1px solid #000", textAlign: "right", padding: "5px 6px", verticalAlign: "middle" }}>{formatAmount(maintTotals.total)}</td>
                            <td style={{ borderRight: "1px solid #000", borderBottom: "1px solid #000" }}></td>
                        </tr>
                    </tbody>
                </table>

                {/* Space between tables */}
                <div style={{ height: "30px" }} />

                {/* Table 2: Asset Cost Consolidation */}
                <div className="section-title" style={{ textAlign: "center", marginBottom: "6px" }}>
                    <span style={{ fontSize: "14px", fontWeight: "bold", textDecoration: "underline", letterSpacing: "1px" }}>
                        CONSOLIDATION
                    </span>
                </div>

                <div
                    className="section-title"
                    style={{
                        backgroundColor: "#d9d9d9",
                        border: "1px solid #000",
                        borderBottom: "none",
                        textAlign: "center",
                        padding: "5px",
                        fontWeight: "bold",
                        fontSize: "12px",
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                    }}
                >
                    GRAND CIVIL & CARPENTRY ASSET COST FOR THE MONTH JUNE 2026
                </div>

                <table
                    style={{
                        width: "100%",
                        borderCollapse: "separate",
                        borderSpacing: 0,
                        fontSize: "10px",
                        borderTop: "1px solid #000",
                        borderLeft: "1px solid #000",
                        boxSizing: "border-box",
                    }}
                >
                    <thead>
                        <tr style={{ backgroundColor: "#efefef", textAlign: "center" }}>
                            <th style={{ borderRight: "1px solid #000", borderBottom: "1px solid #000", width: "35px", padding: "5px 3px" }}>SL</th>
                            <th style={{ borderRight: "1px solid #000", borderBottom: "1px solid #000", width: "180px", padding: "5px" }}>OUTLET</th>
                            <th style={{ borderRight: "1px solid #000", borderBottom: "1px solid #000", width: "70px", padding: "5px" }}>LABOUR CHARGE</th>
                            <th style={{ borderRight: "1px solid #000", borderBottom: "1px solid #000", width: "70px", padding: "5px" }}>MATERIAL CHARGE</th>
                            <th style={{ borderRight: "1px solid #000", borderBottom: "1px solid #000", width: "65px", padding: "5px" }}>OTHER CHARGES</th>
                            <th style={{ borderRight: "1px solid #000", borderBottom: "1px solid #000", width: "75px", padding: "5px" }}>TOTAL AMOUNT</th>
                            <th style={{ borderRight: "1px solid #000", borderBottom: "1px solid #000", padding: "5px" }}>REMARK</th>
                        </tr>
                    </thead>
                    <tbody>
                        {assetData.map((row) => {
                            const rowTotal = row.labour + row.material + row.other;
                            return (
                                <tr key={row.sl}>
                                    <td style={{ borderRight: "1px solid #000", borderBottom: "1px solid #000", textAlign: "center", padding: "4px 3px", verticalAlign: "middle" }}>{row.sl}</td>
                                    <td style={{ borderRight: "1px solid #000", borderBottom: "1px solid #000", padding: "4px 6px", textTransform: "uppercase", verticalAlign: "middle" }}>{row.outlet}</td>
                                    <td style={{ borderRight: "1px solid #000", borderBottom: "1px solid #000", textAlign: "right", padding: "4px 6px", verticalAlign: "middle" }}>{formatAmount(row.labour)}</td>
                                    <td style={{ borderRight: "1px solid #000", borderBottom: "1px solid #000", textAlign: "right", padding: "4px 6px", verticalAlign: "middle" }}>{formatAmount(row.material)}</td>
                                    <td style={{ borderRight: "1px solid #000", borderBottom: "1px solid #000", textAlign: "right", padding: "4px 6px", verticalAlign: "middle" }}>{formatAmount(row.other)}</td>
                                    <td style={{ borderRight: "1px solid #000", borderBottom: "1px solid #000", textAlign: "right", padding: "4px 6px", verticalAlign: "middle" }}>{formatAmount(rowTotal)}</td>
                                    <td style={{ borderRight: "1px solid #000", borderBottom: "1px solid #000", padding: "4px 6px", fontSize: "9px", lineHeight: "1.25", verticalAlign: "middle" }}>{row.remark}</td>
                                </tr>
                            );
                        })}

                        {/* Table 2 Total Row */}
                        <tr style={{ backgroundColor: "#efefef", fontWeight: "bold" }}>
                            <td colSpan={2} style={{ borderRight: "1px solid #000", borderBottom: "1px solid #000", textAlign: "center", padding: "5px", verticalAlign: "middle" }}>TOTAL</td>
                            <td style={{ borderRight: "1px solid #000", borderBottom: "1px solid #000", textAlign: "right", padding: "5px 6px", verticalAlign: "middle" }}>{formatAmount(assetTotals.labour)}</td>
                            <td style={{ borderRight: "1px solid #000", borderBottom: "1px solid #000", textAlign: "right", padding: "5px 6px", verticalAlign: "middle" }}>{formatAmount(assetTotals.material)}</td>
                            <td style={{ borderRight: "1px solid #000", borderBottom: "1px solid #000", textAlign: "right", padding: "5px 6px", verticalAlign: "middle" }}>{formatAmount(assetTotals.other)}</td>
                            <td style={{ borderRight: "1px solid #000", borderBottom: "1px solid #000", textAlign: "right", padding: "5px 6px", verticalAlign: "middle" }}>{formatAmount(assetTotals.total)}</td>
                            <td style={{ borderRight: "1px solid #000", borderBottom: "1px solid #000" }}></td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
}