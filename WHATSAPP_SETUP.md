# WhatsApp Integration Setup Guide

## Problem
The error `Twilio could not find a Channel with the specified From address` occurs because the phone number `+16813813124` is not properly configured for WhatsApp messaging.

## Solution

### 1. Environment Variables Setup

Make sure you have these environment variables in your `.env` file:

```env
# Twilio Configuration
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=your_whatsapp_phone_number

# Environment (important!)
NODE_ENV=development  # or production

# Admin phone for notifications
ADMIN_PHONE_NUMBER=+918458825347
```

### 2. WhatsApp Configuration Options

#### Option A: Sandbox Mode (Recommended for Testing)
- **Use Case**: Development and testing
- **Phone Number**: Automatically uses `+14155238886` (Twilio's sandbox)
- **Setup**: 
  1. Set `NODE_ENV` to anything other than "production"
  2. Recipients must join your sandbox first

#### Option B: Business Number (Production)
- **Use Case**: Live production environment
- **Phone Number**: Your verified WhatsApp Business number
- **Setup**:
  1. Set `NODE_ENV=production`
  2. Configure `TWILIO_PHONE_NUMBER` with your verified number
  3. Number must be approved by Twilio for WhatsApp

### 3. Testing Your Setup

Run the test script to verify your configuration:

```bash
# Test with a specific phone number
node scripts/test-whatsapp.js +918458825347

# Test with admin phone (if configured)
node scripts/test-whatsapp.js
```

### 4. Sandbox Setup (For Testing)

If using sandbox mode:

1. **Get your sandbox code**:
   - Go to [Twilio Console](https://console.twilio.com/)
   - Navigate to Messaging > Try it out > Send a WhatsApp message
   - Copy your sandbox code

2. **Join the sandbox**:
   - Send `join <your-sandbox-code>` to `+14155238886`
   - Example: `join abc123` (replace with your actual code)

3. **Test the integration**:
   - Run the test script
   - Try placing an order in your application

### 5. Production Setup (For Live Use)

1. **Get a WhatsApp Business number**:
   - Apply for WhatsApp Business API through Twilio
   - Wait for approval (can take several days)

2. **Configure your environment**:
   ```env
   NODE_ENV=production
   TWILIO_PHONE_NUMBER=+1234567890  # Your approved number
   ```

3. **Test thoroughly** before going live

### 6. Common Issues and Solutions

#### Error 63007: "Channel not found"
- **Cause**: Wrong phone number or not configured for WhatsApp
- **Solution**: Use sandbox number for testing or verify your business number

#### Error 63014: "Recipient not in sandbox"
- **Cause**: Recipient hasn't joined your WhatsApp sandbox
- **Solution**: Ask them to send `join <sandbox-code>` to `+14155238886`

#### Error 63016: "Template error"
- **Cause**: Message content violates WhatsApp policies
- **Solution**: Review message content and ensure it follows WhatsApp guidelines

### 7. Message Templates (Production)

For production use, you may need to use pre-approved message templates:
- Templates must be approved by WhatsApp
- Can only send free-form messages within 24 hours of customer's last message
- Consider implementing template management

### 8. Monitoring and Debugging

The updated code includes:
- Detailed error logging
- Configuration validation
- Environment-aware phone number selection
- Better error messages with solutions

### 9. Next Steps

1. **For Testing**: Use sandbox mode with `NODE_ENV=development`
2. **For Production**: Apply for WhatsApp Business API and use `NODE_ENV=production`
3. **Monitor**: Check logs for WhatsApp delivery status
4. **Optimize**: Consider message templates and delivery timing

## Quick Fix for Current Issue

To immediately fix the current error:

1. **Set environment variables**:
   ```env
   NODE_ENV=development
   TWILIO_ACCOUNT_SID=your_sid
   TWILIO_AUTH_TOKEN=your_token
   ```

2. **Join the sandbox** (if testing):
   - Send `join <sandbox-code>` to `+14155238886`

3. **Test the integration**:
   ```bash
   node scripts/test-whatsapp.js +918458825347
   ```

This will automatically use the sandbox number and should resolve the "Channel not found" error. 