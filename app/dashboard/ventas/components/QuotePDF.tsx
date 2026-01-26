import React from 'react';
import { Page, Text, View, Document, StyleSheet, Image, Font } from '@react-pdf/renderer';

// Define fonts and styles
Font.register({
    family: 'Helvetica',
    fonts: [
        { src: 'https://fonts.gstatic.com/s/helveticaneue/v70/1Ptsg8zYS_SKggPNyC0IT4ttDfA.ttf' }, // Regular
        { src: 'https://fonts.gstatic.com/s/helveticaneue/v70/1Ptsg8zYS_SKggPNyC0IT4ttDfA.ttf', fontWeight: 'bold' }, // Bold (using regular for now as standard helvetica is built-in usually)
    ]
});

const styles = StyleSheet.create({
    page: {
        padding: 30,
        fontFamily: 'Helvetica',
        fontSize: 9,
        color: '#333',
        lineHeight: 1.4,
    },
    // Header Section
    headerContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    logoContainer: {
        width: '40%',
    },
    logoText: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#000',
    },
    logoSubtext: {
        fontSize: 8,
        color: '#444',
    },
    quoteInfoContainer: {
        width: 'auto',
        alignItems: 'flex-end',
    },
    quoteTitleBox: {
        backgroundColor: '#b91c1c', // Dark Red
        padding: 5,
        paddingHorizontal: 10,
        marginBottom: 5,
    },
    quoteTitleText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 10,
    },
    quoteDetailRow: {
        flexDirection: 'row',
        marginBottom: 2,
    },
    quoteDetailLabel: {
        fontWeight: 'bold',
        marginRight: 5,
    },
    // Company Info
    companyInfo: {
        marginBottom: 15,
    },
    companyName: {
        fontSize: 11,
        fontWeight: 'bold',
        marginBottom: 2,
    },

    // Details Columns
    columnsContainer: {
        flexDirection: 'row',
        marginTop: 10,
        marginBottom: 10,
    },
    columnLeft: {
        width: '50%',
        paddingRight: 10,
    },
    columnRight: {
        width: '50%',
        paddingLeft: 10,
    },
    sectionTitle: {
        color: '#b91c1c',
        fontWeight: 'bold',
        fontSize: 9,
        borderBottomWidth: 1,
        borderBottomColor: '#b91c1c',
        marginBottom: 5,
        paddingBottom: 2,
        textTransform: 'uppercase',
    },
    detailRow: {
        flexDirection: 'row',
        marginBottom: 3,
    },
    detailLabel: {
        width: 'auto',
        fontWeight: 'bold',
        fontSize: 9,
        marginRight: 4,
    },
    detailValue: {
        width: 'auto',
        fontSize: 9,
    },

    // Intro Text
    introText: {
        fontSize: 9,
        fontStyle: 'italic',
        textAlign: 'center',
        marginVertical: 10,
        color: '#555',
    },

    // Table
    table: {
        marginTop: 5,
        borderTopWidth: 0,
    },
    tableHeader: {
        flexDirection: 'row',
        backgroundColor: '#b91c1c',
        color: '#fff',
        padding: 5,
        alignItems: 'center',
    },
    tableRow: {
        flexDirection: 'row',
        borderBottomWidth: 0.5,
        borderBottomColor: '#ddd',
        paddingVertical: 5,
        paddingHorizontal: 5,
        alignItems: 'center',
    },
    colLot: { width: '5%', textAlign: 'center' },
    colDesc: { width: '45%' },
    colQty: { width: '10%', textAlign: 'center' },
    colUnit: { width: '15%', textAlign: 'center' },
    colPrice: { width: '12%', textAlign: 'right' },
    colTotal: { width: '13%', textAlign: 'right' },

    // Totals
    totalsContainer: {
        marginTop: 15,
        alignItems: 'flex-end',
    },
    totalRow: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        marginBottom: 2,
        width: '40%',
    },
    totalLabel: {
        width: '50%',
        textAlign: 'right',
        paddingRight: 10,
        fontWeight: 'bold',
    },
    totalValue: {
        width: '50%',
        textAlign: 'right',
    },
    grandTotalBox: {
        flexDirection: 'row',
        backgroundColor: '#b91c1c',
        color: '#fff',
        padding: 5,
        marginTop: 5,
        width: '40%',
        justifyContent: 'flex-end',
    },

    // Footer / Terms
    footerterms: {
        marginTop: 30,
    },
    termTitle: {
        color: '#b91c1c',
        fontWeight: 'bold',
        fontSize: 9,
        marginBottom: 5,
        borderBottomWidth: 1,
        borderBottomColor: '#b91c1c',
        width: '100%',
    },
    termText: {
        fontSize: 7,
        marginBottom: 2,
        color: '#444',
    },

    // Signature
    signatureContainer: {
        marginTop: 30,
        alignItems: 'center',
    },
    signatureLine: {
        width: 200,
        borderTopWidth: 1,
        borderTopColor: '#000',
        marginTop: 10,
        marginBottom: 5,
    },
    signatureName: {
        fontWeight: 'bold',
        fontSize: 10,
    }
});

// Helper to format currency
const formatCurrency = (amount: number, currency: string = 'MXN') => {
    return new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 2
    }).format(amount);
};

// Helper to format date as 26/ENE/26
const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    try {
        const date = new Date(dateStr + "T12:00:00"); // Avoid timezone shifts
        const day = date.getDate().toString().padStart(2, '0');
        const months = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
        const month = months[date.getMonth()];
        const year = date.getFullYear().toString().slice(-2);
        return `${day}/${month}/${year}`;
    } catch (e) {
        return dateStr;
    }
};

// Main Component
export function QuotePDF({ data, items }: { data: any, items: any[] }) {
    const totalWithTax = Number(data.total) || 0;
    const subtotal = Number(data.subtotal) || 0;
    const tax = Number(data.tax) || Number(data.tax_amount) || 0;

    // Determine the tax percentage display
    const taxPercent = data.tax_rate > 1 ? data.tax_rate : (data.tax_rate * 100);

    return (
        <Document>
            <Page size="A4" style={styles.page}>
                {/* Header */}
                <View style={styles.headerContainer}>
                    <View style={styles.logoContainer}>
                        <Image src="/logo_reyper.png" style={{ width: 120, marginBottom: 10 }} />
                    </View>
                    <View style={styles.quoteInfoContainer}>
                        <View style={styles.quoteTitleBox}>
                            <Text style={styles.quoteTitleText}>COTIZACIÓN: COT-{data.quote_number}</Text>
                        </View>
                        <View style={styles.quoteDetailRow}>
                            <Text style={styles.quoteDetailLabel}>NO. REQ:</Text>
                            <Text>{data.requisition_no || "---"}</Text>
                        </View>
                        <View style={styles.quoteDetailRow}>
                            <Text style={styles.quoteDetailLabel}>NO. PARTE:</Text>
                            <Text>{data.part_no || "---"}</Text>
                        </View>
                        <View style={styles.quoteDetailRow}>
                            <Text style={styles.quoteDetailLabel}>FECHA:</Text>
                            <Text>{formatDate(data.issue_date)}</Text>
                        </View>
                    </View>
                </View>

                {/* Company Address */}
                <View style={styles.companyInfo}>
                    <Text style={styles.companyName}>DMR INDUSTRIAL S.A DE C.V.</Text>
                    <Text>CAMINO REAL NORTE #40, SAN BALTAZAR TEMAXCALAC</Text>
                    <Text>SAN MARTIN TEXMELUCAN, PUEBLA, MEXICO. C.P. 74126</Text>
                    <Text>+52 (248) 2 91 91 34</Text>
                </View>

                {/* Details Columns */}
                <View style={styles.columnsContainer}>
                    {/* Left Col */}
                    <View style={styles.columnLeft}>
                        <Text style={styles.sectionTitle}>COTIZADO A</Text>
                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>CLIENTE:</Text>
                            <Text style={styles.detailValue}>{data.client_name}</Text>
                        </View>
                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>AT'N:</Text>
                            <Text style={styles.detailValue}>{data.contact_name}</Text>
                        </View>
                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>PUESTO:</Text>
                            <Text style={styles.detailValue}>{data.position_name}</Text>
                        </View>
                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>ÁREA:</Text>
                            <Text style={styles.detailValue}>{data.area_name}</Text>
                        </View>
                    </View>

                    {/* Right Col */}
                    <View style={styles.columnRight}>
                        <Text style={styles.sectionTitle}>VIGENCIA Y CONDICIONES</Text>
                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>MONEDA:</Text>
                            <Text style={styles.detailValue}>{data.currency}</Text>
                        </View>
                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>CONDICIONES:</Text>
                            <Text style={styles.detailValue}>{data.payment_terms_days} días</Text>
                        </View>
                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>VIGENCIA:</Text>
                            <Text style={styles.detailValue}>{data.validity_days} días</Text>
                        </View>
                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>ENTREGA:</Text>
                            <Text style={styles.detailValue}>{formatDate(data.delivery_date)}</Text>
                        </View>
                    </View>
                </View>

                {/* Intro */}
                <Text style={styles.introText}>
                    De acuerdo a su amable solicitud, tenemos el gusto de cotizarles los artículos que a continuación se detallan.
                </Text>

                {/* Items Table */}
                <View style={styles.table}>
                    {/* Header */}
                    <View style={styles.tableHeader}>
                        <Text style={styles.colLot}>LOT.</Text>
                        <Text style={styles.colDesc}>DESCRIPCIÓN</Text>
                        <Text style={styles.colQty}>CANT.</Text>
                        <Text style={styles.colUnit}>U.M.</Text>
                        <Text style={styles.colPrice}>P. UNITARIO</Text>
                        <Text style={styles.colTotal}>TOTAL</Text>
                    </View>

                    {/* Rows */}
                    {items.map((item, index) => (
                        <View key={index} style={styles.tableRow} wrap={false}>
                            <Text style={styles.colLot}>{index + 1}</Text>
                            <Text style={styles.colDesc}>{item.description}</Text>
                            <Text style={styles.colQty}>{item.quantity}</Text>
                            <Text style={styles.colUnit}>{item.unit}</Text>
                            <Text style={styles.colPrice}>{formatCurrency(item.unit_price, data.currency)}</Text>
                            <Text style={styles.colTotal}>{formatCurrency(item.quantity * item.unit_price, data.currency)}</Text>
                        </View>
                    ))}
                </View>

                {/* Totals */}
                <View style={styles.totalsContainer}>
                    <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>SUBTOTAL</Text>
                        <Text style={styles.totalValue}>{formatCurrency(subtotal, data.currency)}</Text>
                    </View>
                    <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>I.V.A ({taxPercent.toFixed(0)}%)</Text>
                        <Text style={styles.totalValue}>{formatCurrency(tax, data.currency)}</Text>
                    </View>
                    <View style={styles.grandTotalBox}>
                        <Text style={{ fontWeight: 'bold', marginRight: 10 }}>TOTAL</Text>
                        <Text style={{ fontWeight: 'bold' }}>{formatCurrency(totalWithTax, data.currency)}</Text>
                    </View>
                </View>

                {/* Terms */}
                <View style={styles.footerterms}>
                    <Text style={styles.termTitle}>TÉRMINOS Y CONDICIONES</Text>
                    <Text style={styles.termText}><Text style={{ fontWeight: 'bold' }}>PRECIO UNITARIO:</Text> MÁS I.V.A</Text>
                    <Text style={styles.termText}><Text style={{ fontWeight: 'bold' }}>GARANTÍA:</Text> REYPER garantiza por un año los productos contra defectos de fabricación bajo condiciones normales de operación.</Text>
                    <Text style={styles.termText}><Text style={{ fontWeight: 'bold' }}>CANCELACIÓN:</Text> Requiere consentimiento escrito. Cargo del 30% por gastos efectuados y 50% en equipo especial.</Text>
                    <Text style={styles.termText}><Text style={{ fontWeight: 'bold' }}>DEVOLUCIÓN:</Text> No se aceptan devoluciones después de 5 días hábiles de entregado el material.</Text>
                </View>

                {/* Signature */}
                <View style={styles.signatureContainer}>
                    <Text style={{ fontSize: 9, marginBottom: 50 }}>Atentamente</Text>

                    <View style={styles.signatureLine} />
                    <Text style={styles.signatureName}>ING. JOSÉ DE JESÚS REYES RAMOS</Text>
                </View>

            </Page>
        </Document>
    );
}
