# Delhivery Integration Setup Guide

## Overview
Your Moha Weaves system already has comprehensive Delhivery integration. This guide helps you complete the setup.

## ✅ Already Implemented
- Automatic shipment creation
- Real-time tracking via webhooks  
- Address validation and parsing
- Multi-environment support (staging/production)
- Cancel shipment functionality
- Complete status tracking

## 🔧 Required Setup

### 1. Environment Variables
Add these to your `.env` file:

```bash
# Required Delhivery Configuration
DELHIVERY_API_TOKEN=your_delhivery_api_token_here
DELHIVERY_PICKUP_WAREHOUSE=Moha Weaves
DELHIVERY_WEBHOOK_SECRET=your_webhook_secret_here

# Seller Information (for shipping labels)
SELLER_NAME=Moha Weaves
SELLER_ADDRESS=123, Market Street, Karol Bagh
SELLER_PINCODE=110005
SELLER_CITY=New Delhi
SELLER_STATE=Delhi
SELLER_COUNTRY=India
SELLER_GST_TIN=07AAAPM1234C1ZV

# Optional - For Testing
DELHIVERY_TEST_URL=https://test.delhivery.com
```

### 2. Get Delhivery API Credentials

1. **Login to Delhivery Dashboard**
   - Go to [Delhivery Merchant Panel](https://track.delhivery.com/merchant-panel)
   - Login with your merchant credentials

2. **Generate API Token**
   - Navigate to Settings → API Integration
   - Generate new API token
   - Copy the token to `DELHIVERY_API_TOKEN`

3. **Get Webhook Secret**
   - In API Integration settings, find webhook configuration
   - Generate webhook secret
   - Copy to `DELHIVERY_WEBHOOK_SECRET`

### 3. Configure Webhooks

1. **Webhook URL Setup**
   ```
   Production: https://yourdomain.com/api/webhooks/delhivery
   Staging: https://staging.yourdomain.com/api/webhooks/delhivery
   ```

2. **Webhook Events to Subscribe**
   - Status Updates
   - Pickup Scheduled  
   - Delivery Exceptions
   - RTO Initiated

3. **Test Webhook**
   ```bash
   curl -X POST https://yourdomain.com/api/webhooks/delhivery \
     -H "Content-Type: application/json" \
     -H "X-Delhivery-Signature: test_signature" \
     -d '{
       "waybill": "TEST123456789",
       "status": "Dispatched",
       "order_id": "TEST-ORDER-001"
     }'
   ```

## 🚀 Testing Integration

### 1. Test Shipment Creation
```bash
# Check webhook health
curl https://yourdomain.com/api/webhooks/health

# Test with a real order (use test order first)
# The system will automatically create Delhivery shipment when:
# - Order payment is verified
# - Shipping method is "delhivery"
# - Environment variables are configured
```

### 2. Test Tracking
```bash
# Check webhook configuration
curl https://yourdomain.com/api/webhooks/config
```

## 📋 Integration Features

### Order Processing Flow
1. **User places order** → Payment verified
2. **Automatic shipping** → Delhivery shipment created
3. **Waybill generated** → Tracking number assigned
4. **Customer notified** → SMS/Email with tracking details
5. **Status updates** → Real-time webhook updates
6. **Delivery completion** → Final status update

### API Endpoints Available
- `POST /api/webhooks/delhivery` - Receive status updates
- `GET /api/webhooks/health` - Check webhook service
- `GET /api/webhooks/config` - View webhook configuration
- `POST /api/webhooks/test` - Test webhook functionality

### Shipment Operations
- **Create Shipment**: Automatic on order payment
- **Track Shipment**: Real-time status via API
- **Cancel Shipment**: If needed before pickup
- **Address Validation**: Automatic correction if needed

## 🔍 Troubleshooting

### Common Issues

1. **"DELHIVERY_TOKEN missing"**
   - Add `DELHIVERY_API_TOKEN` to environment variables

2. **"Invalid signature" webhook error**
   - Check `DELHIVERY_WEBHOOK_SECRET` configuration
   - Ensure webhook URL is correctly configured in Delhivery dashboard

3. **"Order not found" errors**
   - Verify order exists in database
   - Check shipping method is set to "delhivery"

4. **Address parsing issues**
   - Ensure shipping address includes pincode and phone
   - Format: `Street, City, State, Pincode, Phone`

### Debug Mode
Enable debug logging by setting:
```bash
DEBUG=delhivery:*
```

## 📞 Delhivery Support

### Important Contacts
- **Merchant Support**: merchant.support@delhivery.com
- **API Support**: api.support@delhivery.com
- **Technical Helpline**: +91-124-6719400

### Useful Links
- [Merchant Dashboard](https://track.delhivery.com/merchant-panel)
- [API Documentation](https://docs.delhivery.com/)
- [Tracking Portal](https://www.delhivery.com/track/)

## ✅ Production Checklist

Before going live with Delhivery integration:

- [ ] All environment variables configured
- [ ] API token tested and working
- [ ] Webhook URL configured in Delhivery dashboard
- [ ] Test order processed successfully
- [ ] Webhook receiving status updates
- [ ] Customer notifications working
- [ ] Error handling verified
- [ ] Pickup address verified
- [ ] GST information configured
- [ ] Return address configured

## 🎯 Next Steps

1. **Complete Environment Setup**
2. **Test with Sample Order**
3. **Verify Webhook Integration**
4. **Monitor First Live Orders**
5. **Setup Monitoring/Alerts**

Your Delhivery integration is now ready for production! 🚀
