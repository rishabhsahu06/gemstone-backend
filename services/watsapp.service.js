import twilio from "twilio"
import config from "../config/config.js"

// Initialize Twilio client
const client = twilio(config.whatsapp.accountSid, config.whatsapp.authToken)

/**
 * Send WhatsApp message using Twilio
 * @param {string} to - Recipient phone number with country code
 * @param {string} message - Message content
 * @returns {Promise} - Twilio message response
 */
export const sendWhatsAppMessage = async (to, message) => {
  try {
    // Validate configuration
    if (!config.whatsapp.phoneNumber || !config.whatsapp.accountSid || !config.whatsapp.authToken) {
      throw new Error("WhatsApp configuration is incomplete")
    }

    // Format phone numbers properly
    const fromNumber = config.whatsapp.phoneNumber.startsWith('+') 
      ? `whatsapp:${config.whatsapp.phoneNumber}` 
      : `whatsapp:+${config.whatsapp.phoneNumber}`
    
    const toNumber = to.startsWith('+') 
      ? `whatsapp:${to}` 
      : `whatsapp:+${to}`

    console.log(`Attempting to send WhatsApp message from ${fromNumber} to ${toNumber}`)

    const response = await client.messages.create({
      body: message,
      from: fromNumber,
      to: toNumber,
    })

    console.log(`WhatsApp message sent successfully with SID: ${response.sid}`)
    return response
  } catch (error) {
    console.error("Error sending WhatsApp message:", error)
    
    // Provide specific error handling for common issues
    if (error.code === 63007) {
      console.error("WhatsApp Channel Error: The 'from' phone number is not properly configured with Twilio WhatsApp")
      console.error("Solutions:")
      console.error("1. If using sandbox, use Twilio's sandbox number: +14155238886")
      console.error("2. If using business number, ensure it's verified and approved")
      console.error("3. Check your Twilio Console WhatsApp configuration")
    } else if (error.code === 63016) {
      console.error("WhatsApp Template Error: Message content may violate WhatsApp policies")
    } else if (error.code === 21211) {
      console.error("Invalid 'To' phone number format")
    }
    
    throw error
  }
}

/**
 * Validate if WhatsApp service is properly configured
 * @returns {boolean} - Configuration status
 */
export const validateWhatsAppConfig = () => {
  const requiredFields = ['phoneNumber', 'accountSid', 'authToken']
  const missing = requiredFields.filter(field => !config.whatsapp[field])
  
  if (missing.length > 0) {
    console.error(`Missing WhatsApp configuration: ${missing.join(', ')}`)
    return false
  }
  
  return true
}