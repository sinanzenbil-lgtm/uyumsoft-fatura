const axios = require('axios');
const xml2js = require('xml2js');

module.exports = async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { startDate, endDate } = req.body;

        const username = process.env.UYUMSOFT_USERNAME;
        const password = process.env.UYUMSOFT_PASSWORD;
        
        // Uyumsoft Canlı API URL
        const apiUrl = 'https://efatura.uyumsoft.com.tr/Services/Integration';

        // SOAP Request for GetInboxInvoiceList (Gelen Faturalar)
        const soapRequest = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tem="http://tempuri.org/">
    <soap:Header/>
    <soap:Body>
        <tem:GetInboxInvoiceList>
            <tem:userInfo>
                <tem:Username>${username}</tem:Username>
                <tem:Password>${password}</tem:Password>
            </tem:userInfo>
            <tem:invoiceListRequest>
                <tem:Taken>All</tem:Taken>
            </tem:invoiceListRequest>
        </tem:GetInboxInvoiceList>
    </soap:Body>
</soap:Envelope>`;

        console.log('=== UYUMSOFT GELEN FATURA API ===');
        console.log('URL:', apiUrl);
        console.log('Username:', username);

        const response = await axios.post(apiUrl, soapRequest, {
            headers: {
                'Content-Type': 'text/xml; charset=utf-8',
                'SOAPAction': 'http://tempuri.org/IIntegration/GetInboxInvoiceList'
            },
            timeout: 60000,
            validateStatus: () => true
        });

        console.log('Response Status:', response.status);

        // Parse XML response
        const parser = new xml2js.Parser({ 
            explicitArray: false, 
            ignoreAttrs: false,
            tagNameProcessors: [xml2js.processors.stripPrefix]
        });

        let invoices = [];
        let parsedResult = null;

        try {
            parsedResult = await parser.parseStringPromise(response.data);
            
            // Navigate through SOAP response structure
            const body = parsedResult?.Envelope?.Body;
            const responseData = body?.GetInboxInvoiceListResponse?.GetInboxInvoiceListResult;
            
            if (responseData?.Value?.InvoiceInfo) {
                const invoiceData = responseData.Value.InvoiceInfo;
                invoices = Array.isArray(invoiceData) ? invoiceData : [invoiceData];
            }
            
            // Check for fault
            if (body?.Fault) {
                return res.status(400).json({
                    success: false,
                    error: body.Fault.faultstring || 'SOAP Fault',
                    faultCode: body.Fault.faultcode,
                    rawResponse: response.data
                });
            }

            // Check for error in response
            if (responseData?.IsSucceded === 'false' || responseData?.IsSucceded === false) {
                return res.status(400).json({
                    success: false,
                    error: responseData?.Message || 'API Error',
                    rawResponse: response.data
                });
            }

        } catch (parseError) {
            console.log('XML Parse Error:', parseError.message);
        }

        // Format invoices for frontend
        const formattedInvoices = invoices.map(inv => ({
            invoiceNumber: inv.InvoiceNumber || inv.ID || '-',
            uuid: inv.UUID || '-',
            invoiceDate: inv.IssueDate || inv.InvoiceDate || '-',
            senderName: inv.SenderName || inv.AccountingSupplierParty?.Party?.PartyName?.Name || '-',
            senderVkn: inv.SenderVkn || inv.SenderIdentifier || '-',
            amount: parseFloat(inv.PayableAmount) || parseFloat(inv.TaxExclusiveAmount) || 0,
            taxAmount: parseFloat(inv.TaxTotal) || parseFloat(inv.TaxAmount) || 0,
            totalAmount: parseFloat(inv.PayableAmount) || parseFloat(inv.GrandTotal) || 0,
            currency: inv.DocumentCurrencyCode || 'TRY',
            status: inv.Status || inv.InvoiceStatus || '-',
            profileId: inv.ProfileId || '-',
            invoiceType: inv.InvoiceTypeCode || inv.InvoiceType || '-'
        }));

        return res.status(200).json({
            success: true,
            type: 'incoming',
            count: formattedInvoices.length,
            invoices: formattedInvoices,
            rawResponse: response.data
        });

    } catch (error) {
        console.error('API Error:', error.message);
        
        return res.status(500).json({
            success: false,
            error: error.message,
            code: error.code,
            details: error.response?.data || error.toString()
        });
    }
};
