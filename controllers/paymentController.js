const crypto = require('crypto');
const axios = require('axios');

exports.initializeJazzCashPayment = async (req, res) => {
  try {
    const { amount, phoneNumber, orderId } = req.body;

    const dateTime = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
    const txnRefNo = `TXN_${Date.now()}`;
    const pp_Amount = amount * 100; // Convert to lowest denomination

    const hashString = `${process.env.JAZZCASH_INTEGRITY_SALT}&${amount}&${orderId}&${process.env.JAZZCASH_MERCHANT_ID}&${phoneNumber}&${process.env.JAZZCASH_PASSWORD}&${txnRefNo}`;
    const secureHash = crypto.createHmac('sha256', process.env.JAZZCASH_INTEGRITY_SALT)
      .update(hashString)
      .digest('hex');

    const payload = {
      pp_Version: '1.1',
      pp_TxnType: 'MWALLET',
      pp_Language: 'EN',
      pp_MerchantID: process.env.JAZZCASH_MERCHANT_ID,
      pp_SubMerchantID: '',
      pp_Password: process.env.JAZZCASH_PASSWORD,
      pp_BankID: '',
      pp_ProductID: '',
      pp_TxnRefNo: txnRefNo,
      pp_Amount: pp_Amount,
      pp_TxnCurrency: 'PKR',
      pp_TxnDateTime: dateTime,
      pp_BillReference: orderId,
      pp_Description: 'Product Purchase',
      pp_TxnExpiryDateTime: dateTime,
      pp_SecureHash: secureHash,
      pp_MobileNumber: phoneNumber,
      pp_CNIC: '',
    };

    const response = await axios.post(process.env.JAZZCASH_API_URL, payload);

    res.json({
      success: true,
      ppOrderID: response.data.pp_TxnRefNo,
      message: 'JazzCash payment initialized'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error initializing JazzCash payment',
      error: error.message
    });
  }
};

exports.initializeEasyPaisaPayment = async (req, res) => {
  try {
    const { amount, phoneNumber, orderId } = req.body;

    const storeId = process.env.EASYPAISA_STORE_ID;
    const hashKey = process.env.EASYPAISA_HASH_KEY;

    const hashString = `${storeId}${orderId}${amount}${hashKey}`;
    const hash = crypto.createHash('sha256').update(hashString).digest('hex');

    const payload = {
      storeId,
      orderId,
      transactionAmount: amount,
      mobileAccountNo: phoneNumber,
      emailAddress: req.user.email,
      tokenExpiry: '20231231 23:59:59',
      hash
    };

    const response = await axios.post(process.env.EASYPAISA_API_URL, payload);

    res.json({
      success: true,
      orderRefNum: response.data.orderRefNum,
      message: 'EasyPaisa payment initialized'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error initializing EasyPaisa payment',
      error: error.message
    });
  }
}; 