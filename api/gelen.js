const axios = require('axios');
const xml2js = require('xml2js');

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
        
        const apiUrl = 'https://efatura.uyumsoft.com.tr/Services/Integration';

        const soapRequest = `<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
    <s:Header>
        <Security xmlns="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">
            <UsernameToken>
                <Username>${username}</Username>
                <Password>${password}</Password>
            </UsernameToken>
        </Security>
    </s:Header>
    <s:Body>
        <GetInboxInvoiceList xmlns="http://tempuri.org/">
            <invoiceListRequest>
                <Taken xmlns="http://schemas.datacontract.org/2004/07/Uyumsoft.EFatura.Proxy.Integration">All</Taken>
            </invoiceListRequest>
        </GetInboxInvoiceList>
    </s:Body>
</s:Envelope>`;

        const response = await axios.post(apiUrl, soapRequest, {
            headers: {
                'Content-Type': 'text/xml; charset=utf-8',
                'SOAPAction': 'http://tempuri.org/IIntegration/GetInboxInvoiceList'
            },
            timeout: 60000
        });

        const parser = new xml2js.Parser({ 
            explicitArray: false, 
            ignoreAttrs: false,
            tagNameProcessors: [xml2js.processors.stripPrefix]
        });

        let invoices = [];
        let parsedResult = await parser.parseStringPromise(response.data);
        
        const body = parsedResult?.Envelope?.Body;
        const responseData = body?.GetInboxInvoiceListResponse?.GetInboxInvoiceListResult;
        
        if (responseData?.Value?.InvoiceInfo) {
            const invoiceData = responseData.Value.InvoiceInfo;
            invoices = Array.isArray(invoiceData) ? invoiceData : [invoiceData];
        }

        const formattedInvoices = invoices.map(inv => ({
            invoiceNumber: inv.InvoiceNumber || inv.ID || '-',
            uuid: inv.UUID || '-',
            invoiceDate: inv.IssueDate || inv.InvoiceDate || '-',
            senderName: inv.SenderName || '-',
            senderVkn: inv.SenderVkn || '-',
            amount: parseFloat(inv.PayableAmount) || 0,
            taxAmount: parseFloat(inv.TaxTotal) || 0,
            totalAmount: parseFloat(inv.PayableAmount) || 0,
            status: inv.Status || '-'
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
            details: error.response?.data || error.toString()
        });
    }
};
