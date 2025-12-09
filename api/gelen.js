const axios = require('axios');

module.exports = async (req, res) => {
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
        const username = process.env.UYUMSOFT_USERNAME;
        const password = process.env.UYUMSOFT_PASSWORD;
        
        // Uyumsoft Canlı REST API
        const apiUrl = 'http://edonusumapi.uyum.com.tr/api/BasicIntegrationApi';

        const requestBody = {
            "Action": "GetInboxInvoiceList",
            "parameters": {
                "userInfo": {
                    "Username": username,
                    "Password": password
                },
                "query": {
                    "CreateStartDate": "2024-01-01T00:00:00.000",
                    "CreateEndDate": "2025-12-31T23:59:59.999"
                }
            }
        };

        const response = await axios.post(apiUrl, requestBody, {
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            timeout: 60000
        });

        let invoices = [];
        
        if (response.data?.Value) {
            const invoiceData = response.data.Value;
            invoices = Array.isArray(invoiceData) ? invoiceData : [invoiceData];
        }

        const formattedInvoices = invoices.map(inv => ({
            invoiceNumber: inv.InvoiceNumber || inv.ID || '-',
            uuid: inv.UUID || '-',
            invoiceDate: inv.IssueDate || inv.InvoiceDate || inv.CreateDate || '-',
            senderName: inv.SenderName || inv.SenderTitle || '-',
            senderVkn: inv.SenderVkn || inv.SenderIdentifier || '-',
            amount: parseFloat(inv.PayableAmount) || parseFloat(inv.TotalAmount) || 0,
            taxAmount: parseFloat(inv.TaxTotal) || parseFloat(inv.TaxAmount) || 0,
            totalAmount: parseFloat(inv.PayableAmount) || parseFloat(inv.TotalAmount) || 0,
            status: inv.Status || inv.InvoiceStatus || '-'
        }));

        return res.status(200).json({
            success: true,
            count: formattedInvoices.length,
            invoices: formattedInvoices,
            raw: response.data
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.message,
            response: error.response?.data,
            status: error.response?.status
        });
    }
};
