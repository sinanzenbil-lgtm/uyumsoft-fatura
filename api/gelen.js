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
        
        const { startDate, endDate } = req.body;
        
        const start = startDate || '2024-01-01T00:00:00.000';
        const end = endDate || '2025-12-31T23:59:59.999';
        
        const apiUrl = 'http://edonusumapi.uyum.com.tr/api/BasicIntegrationApi';

        const requestBody = {
            "Action": "GetInboxInvoiceList",
            "parameters": {
                "userInfo": {
                    "Username": username,
                    "Password": password
                },
                "query": {
                    "CreateStartDate": start,
                    "CreateEndDate": end
                }
            }
        };

        const response = await axios({
            method: 'post',
            url: apiUrl,
            data: requestBody,
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'Accept': '*/*'
            },
            timeout: 60000
        });

        let invoices = [];
        
        if (response.data?.Data?.Value?.Items) {
            invoices = response.data.Data.Value.Items;
        }

        const formattedInvoices = invoices.map(inv => ({
            invoiceNumber: inv.InvoiceId || '-',
            uuid: inv.DocumentId || '-',
            invoiceDate: inv.ExecutionDate || inv.CreateDateUtc || '-',
            senderName: inv.TargetTitle || '-',
            senderVkn: inv.TargetTcknVkn || '-',
            amount: inv.TaxExclusiveAmount || 0,
            taxAmount: inv.TaxTotal || 0,
            totalAmount: inv.PayableAmount || 0,
            currency: inv.DocumentCurrencyCode || 'TRY',
            status: inv.Status === 1000 ? 'Onaylandı' : inv.Status || '-',
            isNew: inv.IsNew
        }));

        return res.status(200).json({
            success: true,
            count: formattedInvoices.length,
            invoices: formattedInvoices
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.message,
            details: error.response?.data
        });
    }
};
